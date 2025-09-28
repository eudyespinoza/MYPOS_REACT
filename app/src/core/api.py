"""Adaptadores de API para el nuevo front POS."""
from __future__ import annotations

import os
from typing import Any, Dict, Iterable, List

import pyarrow.compute as pc
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from services.caching import actualizar_cache_clientes
from services.config import (
    CACHE_FILE_ATRIBUTOS,
    CACHE_FILE_CLIENTES,
    CACHE_FILE_PRODUCTOS,
    CACHE_FILE_STOCK,
)
from services.d365_interface import (
    run_alta_cliente_d365,
    run_validar_cliente_existente,
)
from services.database import (
    actualizar_last_store,
    get_cart,
    obtener_atributos,
    obtener_grupos_cumplimiento,
    obtener_token_d365,
    save_cart,
)
from services.logging_utils import get_module_logger

from .scheduler import (
    FLAG_FILE,
    load_parquet_atributos,
    load_parquet_clientes,
    load_parquet_productos,
    load_parquet_stock,
)

logger = get_module_logger(__name__)

PRODUCT_COLUMN_MAPPING = {
    'Número de Producto': 'numero_producto',
    'Nombre de Categoría de Producto': 'categoria_producto',
    'Nombre del Producto': 'nombre_producto',
    'Grupo de Cobertura': 'grupo_cobertura',
    'Unidad de Medida': 'unidad_medida',
    'PrecioFinalConIVA': 'precio_final_con_iva',
    'PrecioFinalConDescE': 'precio_final_con_descuento',
    'StoreNumber': 'store_number',
    'TotalDisponibleVenta': 'total_disponible_venta',
    'Signo': 'signo',
    'Multiplo': 'multiplo',
    'CodigoBarras': 'codigo_barras',
}


def ok(data: Any, status: int = 200) -> JsonResponse:
    return JsonResponse(data, status=status, safe=not isinstance(data, list))


def _rename_columns(table, mapping: Dict[str, str]):
    if table is None:
        return None
    try:
        return table.rename_columns([mapping.get(name, name) for name in table.column_names])
    except Exception:  # pragma: no cover - defensivo ante cambios de esquema
        logger.exception("No se pudieron renombrar columnas de productos")
        return table


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    try:
        text = str(value).strip()
        if not text:
            return 0.0
        normalized = text.replace('.', '').replace(',', '.') if text.count(',') == 1 and text.count('.') > 1 else text.replace(',', '.')
        return float(normalized)
    except Exception:
        return 0.0


def _string(value: Any, fallback: str = '') -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


# ---------- Productos ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def products_by_code(request):
    code = _string(request.GET.get('code', '')).lower()
    try:
        if not os.path.exists(CACHE_FILE_PRODUCTOS):
            logger.warning("Archivo de productos no disponible: %s", CACHE_FILE_PRODUCTOS)
        table = load_parquet_productos()
        if table is None:
            return ok({'detail': 'Catálogo de productos no disponible'}, status=503)
        table = _rename_columns(table, PRODUCT_COLUMN_MAPPING)
        data: List[Dict[str, Any]] = []
        remaining = 100
        search_columns = (
            'numero_producto',
            'nombre_producto',
            'codigo_barras',
            'barcode',
            'name',
            'code',
        )
        for batch in table.to_batches(max_chunksize=2048):
            batch_df = batch.to_pandas()
            if code:
                candidates: List[Any] = []
                for column in search_columns:
                    if column in batch_df.columns:
                        series = batch_df[column].astype(str).str.lower()
                        candidates.append(series.str.contains(code, na=False))
                if candidates:
                    mask = candidates[0]
                    for extra in candidates[1:]:
                        mask = mask | extra
                    batch_df = batch_df[mask]
                else:
                    batch_df = batch_df.iloc[0:0]
            if batch_df.empty:
                continue
            batch_df = batch_df.head(remaining)
            for row in batch_df.to_dict('records'):
                codigo = _string(
                    row.get('numero_producto')
                    or row.get('productId')
                    or row.get('codigo')
                    or row.get('id')
                )
                nombre = _string(
                    row.get('nombre_producto')
                    or row.get('nombre')
                    or row.get('productName')
                    or row.get('descripcion')
                    or codigo,
                    codigo or 'Producto',
                )
                categoria = row.get('categoria_producto') or row.get('categoria')
                precio = _to_float(
                    row.get('precio_final_con_descuento')
                    or row.get('precio_final_con_iva')
                    or row.get('precio')
                )
                iva = _to_float(row.get('iva') or 21)
                item = {
                    'id': codigo or row.get('id') or row.get('productId'),
                    'codigo': codigo,
                    'numero_producto': codigo,
                    'nombre': nombre,
                    'nombre_producto': nombre,
                    'precio': precio,
                    'precio_final_con_descuento': row.get('precio_final_con_descuento', precio),
                    'precio_final_con_iva': row.get('precio_final_con_iva', precio),
                    'iva': iva or 21,
                    'categoria': categoria,
                    'categoria_producto': categoria,
                    'grupo_cobertura': row.get('grupo_cobertura'),
                    'unidad_medida': row.get('unidad_medida') or row.get('unidad') or 'Un',
                    'multiplo': row.get('multiplo') or 1,
                    'total_disponible_venta': row.get('total_disponible_venta') or row.get('stock') or 0,
                    'barcode': row.get('barcode') or row.get('codigo_barras'),
                }
                data.append(item)
                remaining -= 1
                if remaining <= 0:
                    break
            if remaining <= 0:
                break
        if not data:
            return ok([])
        return ok(data)
    except Exception:  # pragma: no cover - defensivo
        logger.exception("products_by_code")
        return ok({'detail': 'Error interno al obtener productos'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def product_attributes(request, product_id: str):
    try:
        records: Iterable[Any]
        if os.path.exists(FLAG_FILE):
            table = load_parquet_atributos()
            if table is None:
                records = []
            else:
                try:
                    filtered = table.filter(pc.equal(pc.field('ProductNumber'), str(product_id)))
                except Exception:
                    filtered = table
                records = filtered.to_pandas().to_dict('records') if filtered.num_rows > 0 else []
        else:
            records = obtener_atributos(product_id) or []

        attributes: Dict[str, Any] = {}
        if isinstance(records, list):
            for entry in records:
                key: Any = None
                value: Any = None
                if isinstance(entry, dict):
                    key = entry.get('AttributeName') or entry.get('nombre') or entry.get('Name') or entry.get('descripcion')
                    value = entry.get('AttributeValue') or entry.get('valor') or entry.get('Value') or entry.get('valor_atributo')
                elif isinstance(entry, (tuple, list)) and len(entry) >= 2:
                    key, value = entry[0], entry[1]
                if key:
                    attributes[str(key)] = value
        return ok(attributes)
    except Exception:  # pragma: no cover - defensivo
        logger.exception("product_attributes")
        return ok({'detail': 'Error interno al obtener atributos'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_by_store(request, codigo: str, store: str):
    try:
        if not codigo or not store:
            return ok({'detail': 'Código y tienda son requeridos'}, status=400)
        if not os.path.exists(CACHE_FILE_STOCK):
            logger.warning("Archivo de stock no disponible: %s", CACHE_FILE_STOCK)
        almacenes = [a.strip().upper() for a in (obtener_grupos_cumplimiento(store) or []) if a]
        if not almacenes:
            return ok({'store': store, 'disponible': 0})
        table = load_parquet_stock()
        if table is None:
            return ok({'store': store, 'disponible': 0})
        try:
            match_codigo = pc.equal(pc.field('codigo'), str(codigo).strip().upper())
        except Exception:
            match_codigo = None
        try:
            match_store = pc.field('almacen_365').isin(almacenes)
        except Exception:
            match_store = None
        filtered = table
        if match_codigo is not None:
            filtered = filtered.filter(match_codigo)
        if match_store is not None:
            filtered = filtered.filter(match_store)
        df = filtered.to_pandas() if filtered.num_rows > 0 else []
        if isinstance(df, list):
            rows = df
        else:
            rows = df.to_dict('records')
        disponible = sum(_to_float(row.get('disponible_venta') or row.get('disponible') or 0) for row in rows)
        return ok({'store': store, 'disponible': disponible})
    except Exception:  # pragma: no cover - defensivo
        logger.exception("stock_by_store")
        return ok({'detail': 'Error interno al obtener stock'}, status=500)


# ---------- Carrito remoto (en sesión/DB) ----------
def _get_session_cart(request) -> Dict[str, Any]:
    return request.session.get('pos_cart', {'lines': [], 'meta': {}})


def _set_session_cart(request, cart: Dict[str, Any]):
    request.session['pos_cart'] = cart
    request.session.modified = True


def _resolve_user_id(request) -> str | None:
    session_email = request.session.get('email')
    if session_email:
        return session_email
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        if getattr(user, 'email', None):
            return user.email
        return str(user.pk)
    return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_cart(request):
    try:
        user_id = _resolve_user_id(request)
        if user_id:
            data = get_cart(user_id)
            if data:
                return ok(data)
        return ok(_get_session_cart(request))
    except Exception:  # pragma: no cover
        logger.exception("get_user_cart")
        return ok({'detail': 'Error interno al recuperar carrito'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_user_cart(request):
    payload = request.data or {}
    if not isinstance(payload, dict):
        return ok({'detail': 'Formato inválido'}, status=400)
    cart = payload.get('cart') or payload.get('lines')
    if cart is None:
        cart = payload
    user_id = payload.get('userId') or _resolve_user_id(request)
    if not user_id:
        return ok({'detail': 'No se pudo determinar el usuario'}, status=400)
    timestamp = payload.get('timestamp') or timezone.now().isoformat()
    if isinstance(cart, dict):
        cart.setdefault('lines', cart.get('lines', []))
    try:
        if isinstance(cart, dict) and save_cart(user_id, cart, timestamp):
            return ok({'userId': user_id, 'cart': cart, 'timestamp': timestamp})
        if isinstance(cart, dict):
            snapshot = {'cart': cart, 'timestamp': timestamp}
        else:
            snapshot = {'lines': cart, 'meta': {}}
        _set_session_cart(request, snapshot)
        return ok(snapshot)
    except Exception:  # pragma: no cover
        logger.exception("save_user_cart")
        return ok({'detail': 'Error interno al guardar carrito'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_last_store(request):
    store = request.data.get('store') or request.data.get('store_id')
    if not store:
        return ok({'detail': 'store requerido'}, status=400)
    try:
        email = request.session.get('email')
        if not email:
            return ok({'detail': 'Usuario no autenticado'}, status=401)
        actualizar_last_store(email, store)
        request.session['last_store'] = store
        request.session.modified = True
        return ok({'store': store})
    except Exception:  # pragma: no cover
        logger.exception("update_last_store")
        return ok({'detail': 'Error interno al actualizar store'}, status=500)


# ---------- Clientes ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customers_search(request):
    query = _string(request.GET.get('query', '')).lower()
    if not query:
        return ok([])
    try:
        if not os.path.exists(CACHE_FILE_CLIENTES):
            logger.warning("Archivo de clientes no disponible: %s", CACHE_FILE_CLIENTES)
        table = load_parquet_clientes()
        if table is None:
            return ok([])
        df = table.to_pandas()
        mask = None
        for column in ('nif', 'numero_cliente', 'nombre_cliente', 'nombre_completo', 'doc', 'dni'):
            if column in df.columns:
                series = df[column].astype(str).str.lower()
                current = series.str.contains(query, na=False)
                mask = current if mask is None else (mask | current)
        if mask is not None:
            df = df[mask]
        df = df.head(50)
        results: List[Dict[str, Any]] = []
        for row in df.to_dict('records'):
            results.append({
                'id': row.get('numero_cliente') or row.get('id'),
                'numero_cliente': row.get('numero_cliente') or row.get('id'),
                'nombre': row.get('nombre') or row.get('nombre_cliente') or row.get('nombre_completo'),
                'nombre_completo': row.get('nombre_completo') or row.get('nombre_cliente'),
                'doc': row.get('doc') or row.get('nif') or row.get('dni'),
                'dni': row.get('dni'),
                'nif': row.get('nif'),
                'email': row.get('email'),
                'telefono': row.get('telefono'),
                'direccion': row.get('direccion') or row.get('direccion_completa'),
                'store_preferida': row.get('store_preferida'),
            })
        return ok(results)
    except Exception:  # pragma: no cover
        logger.exception("customers_search")
        return ok({'detail': 'Error interno al buscar clientes'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def customers_create(request):
    payload = request.data or {}
    if not isinstance(payload, dict):
        return ok({'detail': 'Formato inválido'}, status=400)
    required = ['nombre', 'apellido', 'dni', 'email', 'telefono', 'codigo_postal', 'ciudad', 'estado', 'condado', 'calle', 'altura']
    missing = [field for field in required if not _string(payload.get(field))]
    if missing:
        return ok({'detail': f'Faltan campos requeridos: {", ".join(missing)}'}, status=400)
    try:
        token = obtener_token_d365()
        if not token:
            return ok({'detail': 'No se pudo obtener token D365'}, status=500)
        customer_id, error = run_alta_cliente_d365(payload, token)
        if error:
            return ok({'detail': error}, status=500)
        try:
            actualizar_cache_clientes()
        except Exception:
            logger.warning("No se pudo invalidar cache de clientes", exc_info=True)
        response = {
            'id': customer_id,
            'numero_cliente': customer_id,
            'nombre': payload.get('nombre'),
            'apellido': payload.get('apellido'),
            'nombre_completo': f"{payload.get('nombre', '')} {payload.get('apellido', '')}".strip(),
            'dni': payload.get('dni'),
            'doc': payload.get('dni'),
            'email': payload.get('email'),
            'telefono': payload.get('telefono'),
            'codigo_postal': payload.get('codigo_postal'),
            'ciudad': payload.get('ciudad'),
            'estado': payload.get('estado'),
            'condado': payload.get('condado'),
            'calle': payload.get('calle'),
            'altura': payload.get('altura'),
        }
        return ok(response, status=201)
    except Exception:  # pragma: no cover
        logger.exception("customers_create")
        return ok({'detail': 'Error interno al crear cliente'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def customers_validate(request):
    payload = request.data or {}
    doc = _string(payload.get('doc') or payload.get('dni'))
    if not doc:
        return ok({'valid': False, 'detail': 'doc requerido'}, status=400)
    try:
        token = obtener_token_d365()
        if not token:
            return ok({'valid': False, 'detail': 'No se pudo obtener token D365'}, status=500)
        exists, result = run_validar_cliente_existente(doc, token)
        if exists is None:
            return ok({'valid': False, 'detail': result or 'No se pudo validar'}, status=500)
        if exists:
            return ok({'valid': False, 'cliente': result})
        return ok({'valid': True})
    except Exception:  # pragma: no cover
        logger.exception("customers_validate")
        return ok({'valid': False, 'detail': 'Error interno al validar'}, status=500)
