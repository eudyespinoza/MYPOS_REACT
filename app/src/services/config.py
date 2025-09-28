import os
import platform

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# By default parquet files are now stored in the server directory requested
# External process will post .parquet files to /srv/data/cache (Linux: QA/PROD)
# or C:\cache (Windows: DEV). Allow override via SERVICES_CACHE_DIR env var.

# Detectar el sistema operativo para usar el directorio correcto y contemplar
# entornos híbridos (por ejemplo, desarrollo en Windows ejecutando Docker o
# WSL donde los archivos siguen viviendo en ``C:\cache``).
_env_cache_dir = os.environ.get("SERVICES_CACHE_DIR")

_candidate_dirs = []
if _env_cache_dir:
    _candidate_dirs.append(_env_cache_dir)

system_name = platform.system()
if system_name == "Windows":
    _candidate_dirs.append(r"C:\\cache")
else:
    # Ruta usada en QA/PROD (Linux)
    _candidate_dirs.append("/srv/data/cache")
    # Si el proceso se ejecuta en Linux pero los archivos están expuestos desde
    # Windows (p. ej. montajes compartidos), validar si existe C:\cache y usarlo.
    windows_cache = r"C:\\cache"
    if os.path.isdir(windows_cache):
        _candidate_dirs.append(windows_cache)

    # Entornos WSL montan las unidades de Windows bajo /mnt. Aunque el directorio
    # ``C:\\cache`` existe desde la perspectiva de Windows, desde Linux/WSL la
    # ruta válida es ``/mnt/c/cache``. Si detectamos esta ubicación la añadimos
    # como candidata para que los datos aparezcan en el front sin configuraciones
    # manuales adicionales.
    wsl_cache = "/mnt/c/cache"
    if os.path.isdir(wsl_cache):
        _candidate_dirs.append(wsl_cache)

# Último recurso: un directorio local dentro del repositorio para desarrollo.
_candidate_dirs.append(os.path.join(BASE_DIR, "cache"))

def _ensure_cache_dir(path: str) -> bool:
    """Try to create the directory if needed, returning True on success."""
    try:
        os.makedirs(path, exist_ok=True)
        return True
    except Exception:
        # Fall back to simply checking existence in case de permisos.
        return os.path.isdir(path)

CACHE_DIR = None
for candidate in _candidate_dirs:
    if not candidate:
        continue
    normalized = os.path.abspath(os.path.expanduser(candidate))
    if _ensure_cache_dir(normalized):
        CACHE_DIR = normalized
        break

# Como salvaguarda, si ninguna ruta funcionó, usa el último candidato y deja
# que los errores de IO posteriores sean más explícitos.
if CACHE_DIR is None:
    CACHE_DIR = os.path.abspath(os.path.expanduser(_candidate_dirs[-1]))

def _build_cache_path(filename: str) -> str:
    return os.path.join(CACHE_DIR, filename)


CACHE_FILE_PRODUCTOS = _build_cache_path('productos_cache.parquet')
CACHE_FILE_STOCK = _build_cache_path('stock_cache.parquet')
CACHE_FILE_CLIENTES = _build_cache_path('clientes_cache.parquet')

# Prefer the plain ``empleados.parquet`` file dropped by the external sync
# process. Keep backwards compatibility with the historical
# ``empleados_cache.parquet`` name to avoid breaking environments that have not
# migrated yet. We pick the first existing candidate; otherwise default to the
# new filename so future writes use the updated convention.
_empleados_candidates = [
    _build_cache_path('empleados.parquet'),
    _build_cache_path('empleados_cache.parquet'),
]
for candidate in _empleados_candidates:
    if os.path.exists(candidate):
        CACHE_FILE_EMPLEADOS = candidate
        break
else:
    CACHE_FILE_EMPLEADOS = _empleados_candidates[0]

CACHE_FILE_ATRIBUTOS = _build_cache_path('atributos_cache.parquet')
CACHE_FILE_CODIGOS_POSTALES = _build_cache_path('codigos_postales_cache.parquet')
