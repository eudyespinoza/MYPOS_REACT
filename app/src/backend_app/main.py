"""Aplicación FastAPI especializada para servir datos al front POS.

La aplicación expone un conjunto mínimo de endpoints que coinciden con los
consumidos por el front-end React incluido en este repositorio. Toda la
información proviene de archivos Parquet que un proceso externo actualiza en el
directorio de caché (por defecto ``C:/cache`` en Windows).

Los endpoints se diseñaron para ser livianos y de baja latencia utilizando
pyarrow para leer los datos en memoria y mantener un caché simple basado en el
``mtime`` de los archivos. De esta forma las consultas son muy rápidas sin
necesidad de un scheduler interno.
"""
from __future__ import annotations

import json
import math
import os
import threading
import unicodedata
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pyarrow.compute as pc
import pyarrow.parquet as pq
from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from services.config import (
    CACHE_DIR,
    CACHE_FILE_ATRIBUTOS,
    CACHE_FILE_CLIENTES,
    CACHE_FILE_PRODUCTOS,
    CACHE_FILE_STOCK,
)

app = FastAPI(title="POS Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Caché de archivos Parquet
# =============================================================================
class ParquetCache:
    """Pequeño caché en memoria basado en el ``mtime`` del archivo."""

    def __init__(self) -> None:
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def load(self, path: str):
        if not path:
            return None
        try:
            mtime = os.path.getmtime(path)
        except FileNotFoundError:
            return None

        with self._lock:
            cached = self._cache.get(path)
            if cached and cached[0] == mtime:
                return cached[1]
            try:
                table = pq.read_table(path)
            except Exception:
                return None
            self._cache[path] = (mtime, table)
            return table


parquet_cache = ParquetCache()


PRODUCT_COLUMN_MAPPING = {
    "Número de Producto": "numero_producto",
    "Nombre de Categoría de Producto": "categoria_producto",
    "Nombre del Producto": "nombre_producto",
    "Grupo de Cobertura": "grupo_cobertura",
    "Unidad de Medida": "unidad_medida",
    "PrecioFinalConIVA": "precio_final_con_iva",
    "PrecioFinalConDescE": "precio_final_con_descuento",
    "StoreNumber": "store_number",
    "TotalDisponibleVenta": "total_disponible_venta",
    "Signo": "signo",
    "Multiplo": "multiplo",
    "CodigoBarras": "codigo_barras",
}

STORE_FIELD_CANDIDATES = (
    "store",
    "store_number",
    "StoreNumber",
    "almacen",
    "almacen_nombre",
    "almacen_365",
)

CLIENTS_EXTRA_FILE = os.path.join(CACHE_DIR, "clientes_extra.json")
REMOTE_CARTS_FILE = os.path.join(CACHE_DIR, "remote_carts.json")
LAST_STORE_FILE = os.path.join(CACHE_DIR, "last_store.json")

_json_lock = threading.Lock()


def _read_json(path: str, default: Any) -> Any:
    try:
        with _json_lock:
            with open(path, "r", encoding="utf-8") as fh:
                return json.load(fh)
    except FileNotFoundError:
        return default
    except Exception:
        return default


def _write_json(path: str, payload: Any) -> None:
    tmp_path = f"{path}.tmp"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with _json_lock:
        with open(tmp_path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
        os.replace(tmp_path, path)


# =============================================================================
# Utilidades de normalización
# =============================================================================
def _rename_columns(table, mapping: Dict[str, str]):
    if table is None:
        return None
    new_names = [mapping.get(name, name) for name in table.column_names]
    try:
        return table.rename_columns(new_names)
    except Exception:
        return table


def _coerce_float(value: Any, fallback: float = 0.0) -> float:
    if value is None:
        return fallback
    if isinstance(value, (int, float)):
        return float(value)
    try:
        text = str(value).strip()
        if not text:
            return fallback
        normalized = text.replace(".", "").replace(",", ".") if text.count(",") == 1 and text.count(".") > 1 else text.replace(",", ".")
        return float(normalized)
    except Exception:
        return fallback


def _string(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _normalize_product(record: Dict[str, Any]) -> Dict[str, Any]:
    codigo = _string(
        record.get("numero_producto")
        or record.get("productId")
        or record.get("id")
        or record.get("codigo"),
    )
    nombre = _string(
        record.get("nombre_producto")
        or record.get("nombre")
        or record.get("productName")
        or record.get("descripcion")
        or codigo
        or "Producto",
        "Producto",
    )
    categoria = record.get("categoria_producto") or record.get("categoria")
    precio = _coerce_float(
        record.get("precio_final_con_descuento")
        or record.get("precio_final_con_iva")
        or record.get("precio"),
    )
    iva = _coerce_float(record.get("iva"), 21.0) or 21.0
    return {
        "id": codigo or record.get("id") or record.get("productId") or nombre,
        "numero_producto": codigo or record.get("id"),
        "codigo": codigo or record.get("id"),
        "nombre": nombre,
        "nombre_producto": nombre,
        "descripcion": record.get("descripcion") or record.get("descripcion_corta") or nombre,
        "categoria": categoria,
        "categoria_producto": categoria,
        "precio": precio,
        "precio_final_con_descuento": record.get("precio_final_con_descuento", precio),
        "precio_final_con_iva": record.get("precio_final_con_iva", precio),
        "iva": iva,
        "grupo_cobertura": record.get("grupo_cobertura"),
        "unidad_medida": record.get("unidad_medida") or record.get("unidad") or "Un",
        "multiplo": record.get("multiplo") or 1,
        "total_disponible_venta": record.get("total_disponible_venta") or record.get("stock") or 0,
        "barcode": record.get("barcode") or record.get("codigo_barras"),
        "imagen_url": record.get("imagen_url"),
    }


def _iter_batches(table) -> Iterable[List[Dict[str, Any]]]:
    for batch in table.to_batches(max_chunksize=2048):
        pdf = batch.to_pandas()
        if pdf.empty:
            continue
        yield pdf.to_dict("records")


def _filter_by_store(table, store: Optional[str]):
    if table is None or not store:
        return table
    store = store.strip().lower()
    expressions = []
    for column in STORE_FIELD_CANDIDATES:
        if column in table.column_names:
            try:
                expressions.append(pc.equal(pc.utf8_lower(pc.field(column)), store))
            except Exception:
                continue
    if not expressions:
        return table
    predicate = expressions[0]
    for expr in expressions[1:]:
        predicate = pc.or_(predicate, expr)
    try:
        return table.filter(predicate)
    except Exception:
        return table


def _collect_store_names() -> List[str]:
    table = parquet_cache.load(CACHE_FILE_STOCK)
    if table is None:
        table = parquet_cache.load(CACHE_FILE_PRODUCTOS)
    if table is None:
        return []
    names: List[str] = []
    for column in STORE_FIELD_CANDIDATES:
        if column in table.column_names:
            try:
                array = table[column]
                lowered = pc.utf8_lower(array)
                unique = pc.unique(lowered).to_pylist()
                names.extend(filter(None, unique))
            except Exception:
                continue
    # Normalizar y quitar duplicados respetando orden
    seen = set()
    ordered: List[str] = []
    for name in names:
        norm = str(name).strip()
        if not norm:
            continue
        upper = norm.upper()
        if upper in seen:
            continue
        seen.add(upper)
        ordered.append(upper)
    return ordered


# =============================================================================
# Endpoints de productos
# =============================================================================
@app.get("/api/productos")
def list_products(
    store: Optional[str] = Query(None, description="Identificador de tienda"),
    page: int = Query(1, ge=1),
    items_per_page: int = Query(5000, ge=1, le=5000),
) -> List[Dict[str, Any]]:
    """Devuelve una página de productos filtrados por tienda."""

    table = parquet_cache.load(CACHE_FILE_PRODUCTOS)
    if table is None:
        return []
    table = _rename_columns(table, PRODUCT_COLUMN_MAPPING)
    table = _filter_by_store(table, store)
    start = (page - 1) * items_per_page
    sliced = table.slice(start, items_per_page)
    records = sliced.to_pylist()
    return [_normalize_product(record) for record in records]


def _normalize_text(value: Any) -> str:
    text = _string(value).lower()
    if not text:
        return ""
    normalized = unicodedata.normalize("NFD", text)
    cleaned = "".join(ch for ch in normalized if ch.isalnum() or ch in {" ", "-", "."})
    return cleaned.strip()


def _matches_tokens(haystack: List[str], tokens: List[str]) -> bool:
    if not tokens:
        return True
    return all(any(token in candidate for candidate in haystack if candidate) for token in tokens)


@app.get("/api/productos/search")
def search_products(
    store: Optional[str] = Query(None, description="Identificador de tienda"),
    query: str = Query("", description="Texto libre para buscar"),
    category: str = Query("", description="Filtrar por categoría"),
    coverage_group: str = Query("", description="Filtrar por grupo de cobertura"),
    min_price: Optional[float] = Query(None, ge=0, description="Precio mínimo"),
    max_price: Optional[float] = Query(None, ge=0, description="Precio máximo"),
    stock_positive: bool = Query(True, description="Incluir productos con stock positivo"),
    stock_zero: bool = Query(True, description="Incluir productos con stock cero"),
    stock_negative: bool = Query(False, description="Incluir productos con stock negativo"),
    sort: str = Query("relevance", description="Criterio de ordenamiento"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
) -> Dict[str, Any]:
    table = parquet_cache.load(CACHE_FILE_PRODUCTOS)
    if table is None:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "per_page": per_page,
            "total_pages": 1,
            "facets": {"categories": [], "coverage_groups": []},
        }

    table = _rename_columns(table, PRODUCT_COLUMN_MAPPING)
    table = _filter_by_store(table, store)

    tokens = [token for token in _normalize_text(query).split() if token]
    normalized_category = _normalize_text(category)
    normalized_coverage = _normalize_text(coverage_group)

    categories: Dict[str, str] = {}
    coverage_groups: Dict[str, str] = {}
    filtered: List[Dict[str, Any]] = []

    include_positive = bool(stock_positive)
    include_zero = bool(stock_zero)
    include_negative = bool(stock_negative)
    apply_stock_filter = include_positive or include_zero or include_negative

    for batch in _iter_batches(table):
        for record in batch:
            product = _normalize_product(record)

            category_value = _string(product.get("categoria"))
            if category_value:
                key = category_value.strip()
                upper = key.upper()
                categories.setdefault(upper, key)

            coverage_value = _string(product.get("grupo_cobertura"))
            if coverage_value:
                key = coverage_value.strip()
                upper = key.upper()
                coverage_groups.setdefault(upper, key)

            if normalized_category and _normalize_text(category_value) != normalized_category:
                continue
            if normalized_coverage and _normalize_text(coverage_value) != normalized_coverage:
                continue

            price_value = _coerce_float(product.get("precio"), 0.0)
            if min_price is not None and price_value < float(min_price):
                continue
            if max_price is not None and price_value > float(max_price):
                continue

            stock_value = _coerce_float(product.get("total_disponible_venta") or product.get("stock"), 0.0)
            if apply_stock_filter:
                matches_stock = False
                if include_positive and stock_value > 0:
                    matches_stock = True
                if include_zero and stock_value == 0:
                    matches_stock = True
                if include_negative and stock_value < 0:
                    matches_stock = True
                if not matches_stock:
                    continue

            haystack = [
                _normalize_text(product.get("nombre")),
                _normalize_text(product.get("descripcion")),
                _normalize_text(product.get("categoria")),
                _normalize_text(product.get("grupo_cobertura")),
                _normalize_text(product.get("codigo")),
                _normalize_text(product.get("barcode")),
            ]
            if not _matches_tokens(haystack, tokens):
                continue

            filtered.append(product)

    if sort == "priceAsc":
        filtered.sort(key=lambda item: _coerce_float(item.get("precio"), 0.0))
    elif sort == "priceDesc":
        filtered.sort(key=lambda item: _coerce_float(item.get("precio"), 0.0), reverse=True)
    elif sort == "nameAsc":
        filtered.sort(key=lambda item: _normalize_text(item.get("nombre")))
    elif sort == "nameDesc":
        filtered.sort(key=lambda item: _normalize_text(item.get("nombre")), reverse=True)
    elif sort == "stockDesc":
        filtered.sort(
            key=lambda item: _coerce_float(item.get("total_disponible_venta") or item.get("stock"), 0.0),
            reverse=True,
        )

    total = len(filtered)
    total_pages = max(1, math.ceil(total / per_page))
    current_page = min(page, total_pages)
    start = (current_page - 1) * per_page
    end = start + per_page
    items = filtered[start:end]

    return {
        "items": items,
        "total": total,
        "page": current_page,
        "per_page": per_page,
        "total_pages": total_pages,
        "facets": {
            "categories": sorted(categories.values(), key=lambda value: value.lower()),
            "coverage_groups": sorted(coverage_groups.values(), key=lambda value: value.lower()),
        },
    }


@app.get("/api/productos/by_code")
def products_by_code(
    code: str = Query("", min_length=1),
    store: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
) -> List[Dict[str, Any]]:
    """Busca productos cuyo código, nombre o código de barras contengan ``code``."""

    table = parquet_cache.load(CACHE_FILE_PRODUCTOS)
    if table is None:
        return []
    table = _rename_columns(table, PRODUCT_COLUMN_MAPPING)
    table = _filter_by_store(table, store)

    code = code.strip().lower()
    if not code:
        return []

    results: List[Dict[str, Any]] = []
    columns = [
        "numero_producto",
        "codigo",
        "nombre_producto",
        "nombre",
        "codigo_barras",
        "barcode",
    ]
    for batch in _iter_batches(table):
        for record in batch:
            haystack = [
                _string(record.get(column)).lower()
                for column in columns
                if column in record and record.get(column) is not None
            ]
            if any(code in value for value in haystack if value):
                results.append(_normalize_product(record))
                if len(results) >= limit:
                    return results
    return results


@app.get("/api/stock/{product_code}/{store_id}")
def stock_by_store(product_code: str, store_id: str) -> List[Dict[str, Any]]:
    table = parquet_cache.load(CACHE_FILE_STOCK)
    if table is None:
        return []
    product_code = product_code.strip().lower()
    store_id = store_id.strip().lower()
    if not product_code or not store_id:
        return []

    records: List[Dict[str, Any]] = []
    for batch in _iter_batches(table):
        for row in batch:
            codigo = _string(row.get("codigo") or row.get("numero_producto") or row.get("productId")).lower()
            if codigo and codigo != product_code:
                continue
            store_candidates = [
                _string(row.get("almacen")),
                _string(row.get("almacen_nombre")),
                _string(row.get("almacen_365")),
                _string(row.get("store")),
            ]
            if store_id not in {candidate.lower() for candidate in store_candidates if candidate}:
                continue
            records.append(
                {
                    "almacen": row.get("almacen") or row.get("almacen_nombre") or row.get("almacen_365") or row.get("store"),
                    "disponible_venta": row.get("disponible_venta") or row.get("stock_venta") or row.get("disponible"),
                    "disponible_entrega": row.get("disponible_entrega") or row.get("disponible_ent"),
                    "comprometido": row.get("comprometido") or row.get("reservado"),
                }
            )
    return records


@app.get("/producto/atributos/{product_id}")
def product_attributes(product_id: str) -> Dict[str, Any]:
    table = parquet_cache.load(CACHE_FILE_ATRIBUTOS)
    if table is None:
        return {}
    product_id = product_id.strip()
    if not product_id:
        return {}

    try:
        filtered = table.filter(pc.equal(pc.field("ProductNumber"), product_id))
    except Exception:
        filtered = table
    if filtered.num_rows == 0:
        return {}
    df = filtered.to_pandas()
    attributes: Dict[str, Any] = {}
    for row in df.to_dict("records"):
        key = row.get("AttributeName") or row.get("Name") or row.get("nombre")
        value = row.get("AttributeValue") or row.get("Value") or row.get("valor")
        if key:
            attributes[str(key)] = value
    return attributes


# =============================================================================
# Clientes
# =============================================================================
def _load_extra_clients() -> List[Dict[str, Any]]:
    data = _read_json(CLIENTS_EXTRA_FILE, [])
    return data if isinstance(data, list) else []


def _save_extra_clients(clients: List[Dict[str, Any]]) -> None:
    _write_json(CLIENTS_EXTRA_FILE, clients)


@app.get("/api/clientes/search")
def search_clients(query: str = Query("", min_length=1)) -> List[Dict[str, Any]]:
    query = query.strip().lower()
    if not query:
        return []

    table = parquet_cache.load(CACHE_FILE_CLIENTES)
    candidates: List[Dict[str, Any]] = []
    if table is not None:
        df = table.to_pandas()
        mask = None
        for column in [
            "nif",
            "numero_cliente",
            "nombre_cliente",
            "nombre_completo",
            "doc",
            "dni",
        ]:
            if column in df.columns:
                series = df[column].astype(str).str.lower()
                current = series.str.contains(query, na=False)
                mask = current if mask is None else (mask | current)
        if mask is not None:
            df = df[mask]
        candidates.extend(df.head(50).to_dict("records"))

    for extra in _load_extra_clients():
        haystack = " ".join(str(extra.get(key, "")) for key in ("numero_cliente", "doc", "dni", "nombre", "nombre_completo"))
        if query in haystack.lower():
            candidates.append(extra)

    results: List[Dict[str, Any]] = []
    for row in candidates[:50]:
        results.append(
            {
                "id": row.get("numero_cliente") or row.get("id"),
                "numero_cliente": row.get("numero_cliente") or row.get("id"),
                "nombre": row.get("nombre") or row.get("nombre_cliente") or row.get("nombre_completo"),
                "nombre_completo": row.get("nombre_completo") or row.get("nombre_cliente"),
                "doc": row.get("doc") or row.get("nif") or row.get("dni"),
                "dni": row.get("dni"),
                "nif": row.get("nif"),
                "email": row.get("email"),
                "telefono": row.get("telefono"),
                "direccion": row.get("direccion") or row.get("direccion_completa"),
                "store_preferida": row.get("store_preferida"),
            }
        )
    return results


@app.post("/api/clientes/create", status_code=201)
def create_client(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    required = [
        "nombre",
        "apellido",
        "dni",
        "email",
        "telefono",
        "codigo_postal",
        "ciudad",
        "estado",
        "condado",
        "calle",
        "altura",
    ]
    missing = [field for field in required if not _string(payload.get(field))]
    if missing:
        raise HTTPException(status_code=400, detail=f"Faltan campos requeridos: {', '.join(missing)}")

    clients = _load_extra_clients()
    numero_cliente = _string(payload.get("dni")) or f"CL-{len(clients)+1:05d}"
    client = {
        "id": numero_cliente,
        "numero_cliente": numero_cliente,
        "nombre": payload.get("nombre"),
        "apellido": payload.get("apellido"),
        "nombre_completo": f"{payload.get('nombre', '')} {payload.get('apellido', '')}".strip(),
        "doc": payload.get("dni"),
        "dni": payload.get("dni"),
        "email": payload.get("email"),
        "telefono": payload.get("telefono"),
        "codigo_postal": payload.get("codigo_postal"),
        "ciudad": payload.get("ciudad"),
        "estado": payload.get("estado"),
        "condado": payload.get("condado"),
        "calle": payload.get("calle"),
        "altura": payload.get("altura"),
    }
    clients = [entry for entry in clients if entry.get("numero_cliente") != numero_cliente]
    clients.append(client)
    _save_extra_clients(clients)
    return client


@app.post("/api/clientes/validate")
def validate_client(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    doc = _string(payload.get("doc") or payload.get("dni"))
    if not doc:
        raise HTTPException(status_code=400, detail="doc requerido")

    table = parquet_cache.load(CACHE_FILE_CLIENTES)
    if table is not None:
        df = table.to_pandas()
        mask = None
        for column in ("doc", "dni", "nif", "numero_cliente"):
            if column in df.columns:
                series = df[column].astype(str).str.lower()
                current = series == doc.lower()
                mask = current if mask is None else (mask | current)
        if mask is not None and mask.any():
            existing = df[mask].head(1).to_dict("records")[0]
            return {"valid": False, "cliente": existing}

    for extra in _load_extra_clients():
        if _string(extra.get("doc")).lower() == doc.lower() or _string(extra.get("dni")).lower() == doc.lower():
            return {"valid": False, "cliente": extra}

    return {"valid": True}


# =============================================================================
# Carrito remoto y sesión
# =============================================================================
def _load_carts() -> Dict[str, Any]:
    data = _read_json(REMOTE_CARTS_FILE, {})
    return data if isinstance(data, dict) else {}


def _save_carts(data: Dict[str, Any]) -> None:
    _write_json(REMOTE_CARTS_FILE, data)


@app.get("/api/get_user_cart")
def get_user_cart(user_id: Optional[str] = Query(None)) -> Dict[str, Any]:
    carts = _load_carts()
    if user_id and user_id in carts:
        return carts[user_id]
    default_user = "anon"
    return carts.get(default_user, {"lines": [], "meta": {}})


@app.post("/api/save_user_cart")
def save_user_cart(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    user_id = _string(payload.get("userId")) or "anon"
    cart = payload.get("cart") or {}
    timestamp = payload.get("timestamp") or datetime.utcnow().isoformat()
    carts = _load_carts()
    carts[user_id] = {"cart": cart, "timestamp": timestamp}
    _save_carts(carts)
    return {"userId": user_id, "cart": cart, "timestamp": timestamp}


@app.post("/api/update_last_store")
def update_last_store(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    store_id = _string(payload.get("store_id") or payload.get("store"))
    if not store_id:
        raise HTTPException(status_code=400, detail="store requerido")
    state = _read_json(LAST_STORE_FILE, {})
    if not isinstance(state, dict):
        state = {}
    state["last_store"] = store_id
    _write_json(LAST_STORE_FILE, state)
    return {"store": store_id}


@app.get("/api/user_info")
def user_info() -> Dict[str, Any]:
    state = _read_json(LAST_STORE_FILE, {})
    stores = _collect_store_names()
    return {
        "email": "demo@pos.local",
        "username": "demo",
        "full_name": "Usuario POS",
        "stores": stores,
        "last_store": state.get("last_store") if isinstance(state, dict) else None,
    }


# =============================================================================
# Utilidades varias
# =============================================================================
@app.get("/health")
def healthcheck() -> Dict[str, Any]:
    return {"status": "ok"}
