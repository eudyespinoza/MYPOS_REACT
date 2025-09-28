"""
Compat layer for legacy imports `from config import ...`.
Re-exports cache file paths from services.config so modules relying on
`config` get the correct, centralized paths that honor SERVICES_CACHE_DIR.
"""
from services.config import (
    CACHE_FILE_PRODUCTOS,
    CACHE_FILE_STOCK,
    CACHE_FILE_CLIENTES,
    CACHE_FILE_EMPLEADOS,
    CACHE_FILE_ATRIBUTOS,
    CACHE_FILE_CODIGOS_POSTALES,
)

