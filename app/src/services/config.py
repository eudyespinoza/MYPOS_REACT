import os
import platform

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# By default parquet files are now stored in the server directory requested
# External process will post .parquet files to /srv/data/parquet (Linux: QA/PROD) 
# or C:\cache (Windows: DEV). Allow override via SERVICES_CACHE_DIR env var.

# Detectar el sistema operativo para usar el directorio correcto
if os.environ.get("SERVICES_CACHE_DIR"):
    DEFAULT_CACHE_DIR = os.environ.get("SERVICES_CACHE_DIR")
elif platform.system() == "Windows":
    DEFAULT_CACHE_DIR = "C:\\cache"
else:
    DEFAULT_CACHE_DIR = "/srv/data/parquet"
# Ensure directory exists (no-op if the path already exists or if permissions
# prevent creation; failures will raise as usual).
CACHE_DIR = DEFAULT_CACHE_DIR
try:
	os.makedirs(CACHE_DIR, exist_ok=True)
except Exception:
	# If we can't create the directory (e.g., permissions), continue and
	# let later IO operations raise clearer errors; do not crash import.
	pass

CACHE_FILE_PRODUCTOS = os.path.join(CACHE_DIR, 'productos_cache.parquet')
CACHE_FILE_STOCK = os.path.join(CACHE_DIR, 'stock_cache.parquet')
CACHE_FILE_CLIENTES = os.path.join(CACHE_DIR, 'clientes_cache.parquet')
CACHE_FILE_EMPLEADOS = os.path.join(CACHE_DIR, 'empleados_cache.parquet')
CACHE_FILE_ATRIBUTOS = os.path.join(CACHE_DIR, 'atributos_cache.parquet')
CACHE_FILE_CODIGOS_POSTALES = os.path.join(CACHE_DIR, 'codigos_postales_cache.parquet')
