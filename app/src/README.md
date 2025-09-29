# MyPOS FastAPI backend

Backend especializado para el frontend POS basado en React. Implementado con **FastAPI** y alimentado por archivos Parquet generados externamente.

## Arranque rápido

```bash
cd app
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend_app.main:app --reload --port 8000
```

La aplicación lee los Parquet desde el directorio configurado en `SERVICES_CACHE_DIR`. Por defecto intenta `/srv/data/cache` en Linux y `C:\cache` en Windows.

## Endpoints principales

- `GET /api/health`: healthcheck simple.
- `GET /api/productos/*`: catálogo de productos y búsqueda.
- `GET /api/clientes/*`: búsqueda de clientes.
- `POST /api/auth/login`: autenticación contra Active Directory con cache de empleados.

## Configuración

Variables relevantes (ver `.env.example`):

- `SERVICES_CACHE_DIR`: ruta donde se encuentran los Parquet.
- `EMP_PARQUET_PATH`: archivo Parquet de empleados para el login.
- Credenciales de servicios externos (Fabric, D365, correo, etc.).

## Notas

El backend oficial es FastAPI ejecutándose con `uvicorn`.
