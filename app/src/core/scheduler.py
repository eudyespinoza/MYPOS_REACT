# core/scheduler.py
import os
import sys
import time
from typing import Optional, Dict, Tuple, Any
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.conf import settings

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.executors.pool import ThreadPoolExecutor as APS_ThreadPoolExecutor
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED

# Actualizadores de caché ya NO se necesitan - proceso externo genera parquet
# from services.caching import (...)

# ETLs / lecturas desde Fabric (solo datos que NO son parquet)
from services.fabric import (
    obtener_datos_tiendas,
    obtener_grupos_cumplimiento_fabric,
)

from services.get_token import get_access_token_d365, TokenRetrievalError
from services.database import guardar_token_d365
from services.email_service import enviar_correo_fallo

# Rutas de archivos Parquet
from services.config import (
    CACHE_FILE_PRODUCTOS,
    CACHE_FILE_CLIENTES,
    CACHE_FILE_STOCK,
    CACHE_FILE_ATRIBUTOS,
    CACHE_FILE_CODIGOS_POSTALES,
)

import pyarrow.parquet as pq
from services.logging_utils import get_module_logger

logger = get_module_logger(__name__)

# =============================================================================
# Marcadores de log (evitar emojis en consolas cp1252)
# =============================================================================
def _supports_emoji() -> bool:
    enc = (getattr(sys.stdout, "encoding", "") or "").lower()
    return "utf" in enc  # ej: 'utf-8'

# Usamos marcadores ASCII siempre (evita UnicodeEncodeError)
OK   = "{OK}"   if _supports_emoji() else "[OK]"
FAIL = "{FAIL}" if _supports_emoji() else "[X]"
ZAP  = "{ZAP}"  if _supports_emoji() else "[*]"

# =============================================================================
# Flag de Bootstrap (compartido con las vistas)
# =============================================================================
FLAG_FILE = os.path.join(settings.BASE_DIR, "bootstrap_done.flag")
# Alias por compatibilidad con código previo
FLAG_BOOTSTRAP = FLAG_FILE

# =============================================================================
# Scheduler config
# =============================================================================
APS_MAX_WORKERS = int(os.getenv("APS_MAX_WORKERS", "10"))

executors = {
    "default": APS_ThreadPoolExecutor(max_workers=APS_MAX_WORKERS),
}
job_defaults = {
    "coalesce": True,     # junta ejecuciones perdidas
    "max_instances": 1,   # evita superposición del mismo job
}
scheduler = BackgroundScheduler(executors=executors, job_defaults=job_defaults)


def job_listener(event):
    if event.exception:
        try:
            enviar_correo_fallo(event.job_id, str(event.exception))
        except Exception:
            logger.exception("Fallo enviando correo de error")
        logger.error(f"Error en tarea {event.job_id}: {event.exception}", exc_info=True)
    else:
        logger.info(f"Tarea {event.job_id} ejecutada correctamente")


scheduler.add_listener(job_listener, EVENT_JOB_ERROR | EVENT_JOB_EXECUTED)

# =============================================================================
# Lectura de Parquet con caché en memoria (evita recargas innecesarias)
# =============================================================================
# cache: ruta -> (mtime, object)
# We keep the table type generic (Any) to avoid a hard dependency in typing on pyarrow
_PARQUET_CACHE: Dict[str, Tuple[float, Any]] = {}

def _load_parquet_cached(path: str):
    """Lee un Parquet con caché en memoria según mtime. Devuelve pyarrow.Table o None."""
    try:
        if not os.path.exists(path):
            return None
        mtime = os.path.getmtime(path)
        cached = _PARQUET_CACHE.get(path)
        if cached and cached[0] == mtime:
            return cached[1]
        tbl = pq.read_table(path)
        _PARQUET_CACHE[path] = (mtime, tbl)
        return tbl
    except Exception:
        logger.exception(f"No se pudo leer Parquet: {path}")
        return None

def load_parquet_productos():
    return _load_parquet_cached(CACHE_FILE_PRODUCTOS)

def load_parquet_clientes():
    return _load_parquet_cached(CACHE_FILE_CLIENTES)

def load_parquet_stock():
    return _load_parquet_cached(CACHE_FILE_STOCK)

def load_parquet_atributos():
    return _load_parquet_cached(CACHE_FILE_ATRIBUTOS)

def load_parquet_codigos_postales():
    return _load_parquet_cached(CACHE_FILE_CODIGOS_POSTALES)

# Compatibilidad histórica (si alguna parte del front aún la usa)
def obtener_productos_cache():
    return load_parquet_productos()

# =============================================================================
# Helpers de ejecución con logging y correo
# =============================================================================
def _run_step(nombre: str, fn, *args, **kwargs):
    """Ejecuta una función simple con logging y aviso por correo en error."""
    t0 = time.perf_counter()
    try:
        fn(*args, **kwargs)
        logger.info(f"{OK} {nombre} OK en {time.perf_counter()-t0:0.2f}s")
    except Exception as e:
        logger.error(f"{FAIL} {nombre} falló: {e}", exc_info=True)
        try:
            enviar_correo_fallo(nombre, str(e))
        except Exception:
            logger.exception("Fallo enviando correo de error")


def _run_step_chain(nombre: str, *fn_chain):
    """
    Ejecuta en orden, en el mismo hilo, una cadena de funciones con dependencia entre sí.
    Ej.: (_obtener, _cachear)
    """
    t0 = time.perf_counter()
    try:
        for fn in fn_chain:
            fn()
        logger.info(f"{OK} {nombre} OK en {time.perf_counter()-t0:0.2f}s")
    except Exception as e:
        logger.error(f"{FAIL} {nombre} falló: {e}", exc_info=True)
        try:
            enviar_correo_fallo(nombre, str(e))
        except Exception:
            logger.exception("Fallo enviando correo de error")


def actualizar_token_d365():
    """Obtiene y persiste el token D365."""
    try:
        token = get_access_token_d365()
    except TokenRetrievalError as exc:
        logger.error(f"{FAIL} get_access_token_d365 falló: {exc}")
        return
    if not token:
        logger.error(f"{FAIL} No se pudo obtener token D365")
        return
    guardar_token_d365(token)
    logger.info("Token D365 actualizado por bootstrap/cron.")

# =============================================================================
# Bootstrap paralelo (primera vez)
# =============================================================================
def bootstrap_parallel(max_workers: Optional[int] = None):
    """
    Ejecuta la carga inicial en paralelo respetando dependencias.
    Lánzalo en un thread (no bloquea Django). Idempotente con FLAG_FILE.
    """
    if os.path.exists(FLAG_FILE):
        logger.info("Bootstrap ya realizado anteriormente.")
        return

    logger.info(f"{ZAP} Iniciando bootstrap paralelo...")
    MAX = max_workers or int(os.getenv("INITIAL_LOAD_MAX_WORKERS", "6"))

    # Trabajos independientes (solo datos que NO son parquet)
    # Los archivos parquet los genera un proceso externo
    jobs = [
        ("datos_tiendas",               _run_step,        obtener_datos_tiendas),
        ("grupos_cumplimiento",         _run_step,        obtener_grupos_cumplimiento_fabric),
        ("token_d365",                  _run_step,        actualizar_token_d365),
    ]

    # Ejecutar en paralelo
    with ThreadPoolExecutor(max_workers=MAX) as ex:
        futures = [ex.submit(j[1], j[0], *j[2:]) for j in jobs]
        for f in as_completed(futures):
            try:
                f.result()  # los helpers ya loguean/avisan mails
            except Exception:
                # ya está registrado por los helpers
                pass

    # Grabar flag (marca de finalización)
    try:
        with open(FLAG_FILE, "w", encoding="utf-8") as fh:
            fh.write(datetime.now().isoformat())
    except Exception:
        logger.exception("No se pudo grabar FLAG_FILE (continuará sin flag)")

    logger.info(f"{OK} Bootstrap paralelo finalizado.")

# =============================================================================
# Registro de cron jobs
# =============================================================================
def start_scheduler_and_jobs():
    """Registra tareas periódicas y arranca el scheduler (idempotente)."""
    logger.info("Iniciando scheduler/background jobs...")

    # Keep-alive
    scheduler.add_job(lambda: logger.info("Scheduler vivo"),
                      CronTrigger(minute="*/5"), id="alive")

    # Token
    scheduler.add_job(actualizar_token_d365,
                      CronTrigger(minute="*/10"), id="token_d365")

    # Cachés “simples”
    # NOTE: TODOS los archivos parquet (productos, clientes, stock, atributos, 
    # empleados, codigos_postales) ahora los publica un proceso externo
    # en /srv/data/cache (Linux) o C:\cache (Windows).
    # Este scheduler solo mantiene jobs para datos que NO son parquet.

    # Semanales (datos que van a la base de datos, no a parquet)
    scheduler.add_job(obtener_grupos_cumplimiento_fabric,
                      CronTrigger(day_of_week="sat", hour=22, minute=0),
                      id="grupos_cumplimiento")
    scheduler.add_job(obtener_datos_tiendas,
                      CronTrigger(day_of_week="sat", hour=22, minute=30),
                      id="datos_tiendas")

    # Start a filesystem watcher to reload parquet cache when external
    # processes update files under CACHE_DIR. We implement a lightweight
    # watcher that prefers 'watchdog' if available, otherwise falls back
    # to a safe polling loop in a background thread.
    _start_parquet_watcher()

    # Arrancar si no está ya corriendo
    if not scheduler.running:
        scheduler.start()

    for job in scheduler.get_jobs():
        logger.info(f"Job: {job.id} | Next: {job.next_run_time} | Trigger: {job.trigger}")


# =============================================================================
# Parquet watcher (reload in-memory cache when files change)
# =============================================================================
def _reload_parquet(path: str):
    """Invalidate or reload caches depending on path changed."""
    try:
        # If core/scheduler keeps an in-memory _PARQUET_CACHE, clear the entry
        if path in _PARQUET_CACHE:
            logger.info(f"Parquet cambiado, recargando cache en memoria: {path}")
            del _PARQUET_CACHE[path]
        # Also clear lru_cache-based loaders in services.caching if present
        try:
            from services import caching as _caching
            # Map known files to cache clear functions
            mapping = {
                CACHE_FILE_PRODUCTOS: getattr(_caching, 'load_products_to_memory', None),
                CACHE_FILE_CLIENTES: getattr(_caching, 'load_parquet_to_memory', None),
                CACHE_FILE_STOCK: getattr(_caching, 'load_stock_to_memory', None),
                CACHE_FILE_ATRIBUTOS: getattr(_caching, 'load_atributos_to_memory', None),
                CACHE_FILE_CODIGOS_POSTALES: None,
            }
            fn = mapping.get(path)
            if fn and hasattr(fn, 'cache_clear'):
                fn.cache_clear()
                # Proactively reload to surface errors early
                try:
                    fn()
                except Exception:
                    logger.exception(f"Error recargando {path} en memoria")
        except Exception:
            logger.exception("No se pudo invalidar caches en services.caching")
    except Exception:
        logger.exception("Error en _reload_parquet")


def _start_parquet_watcher():
    """Start background watcher thread that watches CACHE_DIR for parquet changes.

    Attempts to use watchdog for efficient notifications; falls back to
    a simple mtime polling loop every 5 seconds.
    """
    import threading
    try:
        # Import watchdog dynamically to avoid hard import error during static
        # analysis if the package isn't installed. If import fails, fall back
        # to polling below.
        import importlib
        wd_obs = importlib.import_module('watchdog.observers')
        wd_events = importlib.import_module('watchdog.events')

        Observer = getattr(wd_obs, 'Observer')
        FileSystemEventHandler = getattr(wd_events, 'FileSystemEventHandler')

        class _ParquetHandler(FileSystemEventHandler):
            def on_modified(self, event):
                try:
                    if not event.is_directory and event.src_path.endswith('.parquet'):
                        _reload_parquet(event.src_path)
                except Exception:
                    logger.exception('Error handling parquet modified event')

            def on_created(self, event):
                try:
                    if not event.is_directory and event.src_path.endswith('.parquet'):
                        _reload_parquet(event.src_path)
                except Exception:
                    logger.exception('Error handling parquet created event')

        observer = Observer()
        handler = _ParquetHandler()
        try:
            from services.config import CACHE_DIR as _cache_dir
        except Exception:
            _cache_dir = None
        if _cache_dir:
            observer.schedule(handler, _cache_dir, recursive=False)
            observer.daemon = True
            observer.start()
            logger.info(f"Watcher iniciado en {_cache_dir} (watchdog)")
            return
    except Exception:
        logger.info("watchdog no disponible, usando polling para detectar cambios en parquet")

    # Polling fallback
    def _poll_loop():
        try:
            from services.config import CACHE_DIR as _cache_dir
        except Exception:
            _cache_dir = None
        if not _cache_dir:
            logger.warning("No se conoce CACHE_DIR para watcher; watcher no iniciado")
            return
        mtimes = {}
        while True:
            try:
                for fname in os.listdir(_cache_dir):
                    if not fname.endswith('.parquet'):
                        continue
                    path = os.path.join(_cache_dir, fname)
                    try:
                        m = os.path.getmtime(path)
                    except Exception:
                        continue
                    if path not in mtimes or mtimes[path] != m:
                        mtimes[path] = m
                        _reload_parquet(path)
            except Exception:
                logger.exception("Watcher polling error")
            time.sleep(5)

    t = threading.Thread(target=_poll_loop, daemon=True, name='parquet-watcher')
    t.start()
