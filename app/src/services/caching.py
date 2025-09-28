# services/caching.py
"""
Módulo de caché separado de la carpeta de datos 'services/cache/' para evitar
choques en los imports. Aquí viven las funciones de actualización de caché
usadas por el scheduler.
"""
import os
import datetime
from functools import lru_cache
from services.logging_utils import get_module_logger

import requests
import pyarrow as pa
import pyarrow.parquet as pq
import pandas as pd

from services.email_service import enviar_correo_fallo
from services.database import (
    obtener_stock,
    obtener_empleados,
    obtener_todos_atributos,
)
from services.config import CACHE_FILE_CODIGOS_POSTALES
from services.fabric import obtener_codigos_postales_fabric

logger = get_module_logger(__name__)

# ----------------------------------------------------------------------
# Rutas de archivos de caché
# ----------------------------------------------------------------------
try:
    # Si tienes estos paths en config.py, los usamos
    from config import (
        CACHE_FILE_PRODUCTOS,
        CACHE_FILE_STOCK,
        CACHE_FILE_CLIENTES,
        CACHE_FILE_EMPLEADOS,
        CACHE_FILE_ATRIBUTOS,
    )
except Exception:
    # Fallback seguro
    BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # raíz del repo
    CACHE_DIR = os.path.join(BASE_DIR, "services", "cache")
    os.makedirs(CACHE_DIR, exist_ok=True)
    CACHE_FILE_PRODUCTOS = os.path.join(CACHE_DIR, "productos_cache.parquet")
    CACHE_FILE_CLIENTES  = os.path.join(CACHE_DIR, "clientes_cache.parquet")
    CACHE_FILE_STOCK     = os.path.join(CACHE_DIR, "stock_cache.parquet")
    CACHE_FILE_EMPLEADOS = os.path.join(CACHE_DIR, "empleados_cache.parquet")
    CACHE_FILE_ATRIBUTOS = os.path.join(CACHE_DIR, "atributos_cache.parquet")
    CACHE_FILE_CODIGOS_POSTALES = os.path.join(CACHE_DIR, "codigos_postales_cache.parquet")

# ----------------------------------------------------------------------
# URLs (muévelas a config.ini si prefieres)
# ----------------------------------------------------------------------
# Si ya las cargas de otro lado, puedes borrar estas constantes.
# The external system now places parquet files in SERVICES_CACHE_DIR (default
# /srv/data/cache). The old behavior downloaded these files from Fabric; we
# keep the constants for reference but scheduler-based downloads are removed.
PRODUCTOS_PARQUET_URL = None
CLIENTES_PARQUET_URL = None

# ----------------------------------------------------------------------
# Descargas
# ----------------------------------------------------------------------
def _descargar(url: str, destino: str, nombre: str):
    try:
        logger.info(f"Descargando {nombre} desde URL...")
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        with open(destino, "wb") as f:
            f.write(resp.content)
        logger.info(f"{nombre} descargado en {destino}")
    except Exception as e:
        logger.error(f"Error al descargar {nombre}: {e}", exc_info=True)
        try:
            enviar_correo_fallo(f"descargar_{nombre}", str(e))
        except Exception:
            logger.exception("Fallo enviando correo de error")
        raise

def _hoy(dt_path: str) -> bool:
    """¿El archivo fue modificado hoy?"""
    try:
        mod_time = datetime.date.fromtimestamp(os.path.getmtime(dt_path))
        return mod_time == datetime.date.today()
    except Exception:
        return False

# ----------------------------------------------------------------------
# Cargas en memoria (invalidables)
# ----------------------------------------------------------------------
@lru_cache(maxsize=1)
def load_products_to_memory():
    return pq.read_table(CACHE_FILE_PRODUCTOS)

@lru_cache(maxsize=1)
def load_parquet_to_memory():
    return pq.read_table(CACHE_FILE_CLIENTES)

@lru_cache(maxsize=1)
def load_stock_to_memory():
    return pq.read_table(CACHE_FILE_STOCK)

@lru_cache(maxsize=1)
def load_atributos_to_memory():
    return pq.read_table(CACHE_FILE_ATRIBUTOS)

# ----------------------------------------------------------------------
# API pública usada por el scheduler
# ----------------------------------------------------------------------
def actualizar_cache_productos():
    """Actualiza productos_cache.parquet descargándolo directamente."""
    try:
        # Now a background external process posts productos_cache.parquet into
        # the configured CACHE_DIR. We simply invalidate the in-memory cache
        # and let the watcher proactively reload it when the file appears/changes.
        logger.info("actualizar_cache_productos: operación delegada a proceso externo. Invalidando cache en memoria.")
        load_products_to_memory.cache_clear()
    except Exception as e:
        logger.error(f"Error actualizar_cache_productos: {e}", exc_info=True)
        raise

def actualizar_cache_clientes():
    """Actualiza clientes_cache.parquet descargándolo directamente."""
    try:
        logger.info("actualizar_cache_clientes: operación delegada a proceso externo. Invalidando cache en memoria.")
        load_parquet_to_memory.cache_clear()
    except Exception as e:
        logger.error(f"Error actualizar_cache_clientes: {e}", exc_info=True)
        raise

def actualizar_cache_stock():
    try:
        logger.info("Obteniendo stock (services.database.obtener_stock) para cache...")
        stock_data = obtener_stock(formateado=False)  # <<< NUMÉRICO
        if not stock_data:
            logger.warning("No se encontraron datos de stock para cache.")
            return
        keys = stock_data[0].keys()
        data = {k: [row.get(k) for row in stock_data] for k in keys}
        table = pa.Table.from_pydict(data)
        pq.write_table(table, CACHE_FILE_STOCK)
        load_stock_to_memory.cache_clear()
        logger.info("Caché stock actualizada.")
    except Exception as e:
        logger.error(f"Error actualizar_cache_stock: {e}", exc_info=True)
        try:
            enviar_correo_fallo("actualizar_cache_stock", str(e))
        except Exception:
            logger.exception("Fallo enviando correo de error")
        raise

def actualizar_cache_empleados():
    """Construye el parquet de empleados desde la DB local."""
    try:
        logger.info("Obteniendo empleados (services.database.obtener_empleados) para cache...")
        empleados = obtener_empleados()
        if not empleados:
            logger.warning("No se encontraron empleados para cache.")
            return
        keys = empleados[0].keys()
        data = {k: [row.get(k) for row in empleados] for k in keys}
        table = pa.Table.from_pydict(data)
        pq.write_table(table, CACHE_FILE_EMPLEADOS)
        logger.info("Caché empleados actualizada.")
    except Exception as e:
        logger.error(f"Error actualizar_cache_empleados: {e}", exc_info=True)
        try:
            enviar_correo_fallo("actualizar_cache_empleados", str(e))
        except Exception:
            logger.exception("Fallo enviando correo de error")
        raise


# ----------------------------------------------------------------------
# Helpers para recarga explícita (usados por el watcher)
# ----------------------------------------------------------------------
def reload_parquet_into_memory(path: str):
    """Forzar la recarga de un parquet concreto en las funciones en memoria.

    El watcher puede llamar a esta función pasando la ruta completa del
    archivo .parquet.
    """
    try:
        logger.info(f"Forzando recarga en memoria de {path}")
        # Map path to known caches
        if path == CACHE_FILE_PRODUCTOS:
            load_products_to_memory.cache_clear()
            return load_products_to_memory()
        if path == CACHE_FILE_CLIENTES:
            load_parquet_to_memory.cache_clear()
            return load_parquet_to_memory()
        if path == CACHE_FILE_STOCK:
            load_stock_to_memory.cache_clear()
            return load_stock_to_memory()
        if path == CACHE_FILE_ATRIBUTOS:
            load_atributos_to_memory.cache_clear()
            return load_atributos_to_memory()
        # Unknown path — try a generic read
        return pq.read_table(path)
    except Exception:
        logger.exception(f"Error recargando parquet {path}")
        raise

def actualizar_cache_atributos():
    """Construye el parquet de atributos desde la DB local."""
    try:
        logger.info("Obteniendo atributos (services.database.obtener_todos_atributos) para cache...")
        atributos = obtener_todos_atributos()
        if not atributos:
            logger.warning("No se encontraron atributos para cache.")
            return
        keys = atributos[0].keys()
        data = {k: [row.get(k) for row in atributos] for k in keys}
        table = pa.Table.from_pydict(data)
        pq.write_table(table, CACHE_FILE_ATRIBUTOS)
        load_atributos_to_memory.cache_clear()
        logger.info("Caché atributos actualizada.")
    except Exception as e:
        logger.error(f"Error actualizar_cache_atributos: {e}", exc_info=True)
        try:
            enviar_correo_fallo("actualizar_cache_atributos", str(e))
        except Exception:
            logger.exception("Fallo enviando correo de error")
        raise

def actualizar_cache_codigos_postales():
    """Construye el parquet de códigos postales desde Fabric.

    Columnas: AddressZipCode, AddressCountryRegionId, AddressState, AddressCounty, AddressCity, CountyName
    """
    try:
        logger.info("Obteniendo padrón de códigos postales desde Fabric...")
        rows = obtener_codigos_postales_fabric() or []
        if not rows:
            logger.warning("No se obtuvieron códigos postales para cache.")
            return
        # Normalizar a pydict de listas
        keys = list(rows[0].keys())
        data = {k: [r.get(k) for r in rows] for k in keys}
        table = pa.Table.from_pydict(data)
        pq.write_table(table, CACHE_FILE_CODIGOS_POSTALES)
        logger.info("Caché de códigos postales actualizada.")
    except Exception as e:
        logger.error(f"Error actualizar_cache_codigos_postales: {e}", exc_info=True)
        try:
            enviar_correo_fallo("actualizar_cache_codigos_postales", str(e))
        except Exception:
            logger.exception("Fallo enviando correo de error")
        raise

# ----------------------------------------------------------------------
# Funciones de consulta de datos desde parquet
# ----------------------------------------------------------------------

def obtener_empleado_by_email_from_parquet(email):
    """
    Busca un empleado por email en el archivo parquet de empleados.
    
    Returns:
        dict: Datos del empleado encontrado o diccionario vacío si no se encuentra
    """
    try:
        if not os.path.exists(CACHE_FILE_EMPLEADOS):
            logger.warning(f"Archivo parquet de empleados no encontrado: {CACHE_FILE_EMPLEADOS}")
            return {}
            
        # Leer la tabla parquet
        table = pq.read_table(CACHE_FILE_EMPLEADOS)
        df = table.to_pandas()
        
        if df.empty:
            logger.warning("El archivo parquet de empleados está vacío.")
            return {}
        
        # Filtrar por email
        empleado_row = df[df['email'] == email]
        
        if empleado_row.empty:
            logger.warning(f"No se encontró empleado con email {email} en parquet.")
            return {}
        
        # Convertir a diccionario
        empleado_dict = empleado_row.iloc[0].to_dict()
        
        # Limpiar valores NaN/None
        empleado_dict = {k: v if pd.notna(v) else None for k, v in empleado_dict.items()}
        
        logger.info(f"Empleado encontrado en parquet para email {email}")
        return empleado_dict
        
    except Exception as e:
        logger.error(f"Error al buscar empleado por email en parquet: {e}", exc_info=True)
        return {}
