"""Utilities for querying Parquet datasets used by the FastAPI backend."""
from __future__ import annotations

import os
from functools import reduce
from typing import Iterable, List, Optional, Sequence, Tuple

import pandas as pd
import pyarrow.dataset as ds

from services.config import CACHE_FILE_PRODUCTOS

_TEXT_COLUMNS = (
    "nombre",
    "nombre_producto",
    "descripcion",
    "descripcion_corta",
    "categoria",
    "categoria_producto",
    "codigo",
    "numero_producto",
    "productId",
    "barcode",
    "codigo_barras",
    "sku",
)

_SKU_COLUMNS = ("sku", "numero_producto", "productId", "codigo", "id")
_BARCODE_COLUMNS = ("barcode", "codigo_barras")
_CATEGORY_COLUMNS = ("categoria", "categoria_producto", "Nombre de Categoría de Producto")


def _load_dataset(path: str) -> Optional[ds.Dataset]:
    if not path:
        return None
    if not os.path.exists(path):
        return None
    try:
        return ds.dataset(path, format="parquet")
    except Exception:
        return None


def _combine_filters(expressions: Sequence[ds.Expression]) -> Optional[ds.Expression]:
    if not expressions:
        return None
    return reduce(lambda acc, expr: acc & expr, expressions[1:], expressions[0])


def _build_equality_filter(
    dataset: ds.Dataset, value: str, columns: Iterable[str]
) -> Optional[ds.Expression]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    schema_names = set(dataset.schema.names)
    expressions: List[ds.Expression] = []
    for column in columns:
        if column in schema_names:
            expressions.append(ds.field(column) == value)
    if not expressions:
        return None
    return reduce(lambda acc, expr: acc | expr, expressions[1:], expressions[0])


def _filter_contains(df: pd.DataFrame, value: str, columns: Iterable[str]) -> pd.DataFrame:
    value = (value or "").strip().lower()
    if not value:
        return df
    masks = []
    for column in columns:
        if column in df.columns:
            series = df[column].astype(str).str.lower()
            masks.append(series.str.contains(value, na=False))
    if not masks:
        return df
    mask = masks[0]
    for current in masks[1:]:
        mask |= current
    return df[mask]


def search_products(
    text: Optional[str],
    sku: Optional[str],
    barcode: Optional[str],
    category: Optional[str],
    page: int = 1,
    page_size: int = 100,
    order_by: str = "nombre",
    order_dir: str = "asc",
) -> Tuple[int, List[dict]]:
    dataset = _load_dataset(CACHE_FILE_PRODUCTOS)
    if dataset is None:
        return 0, []

    filters: List[ds.Expression] = []

    sku_filter = _build_equality_filter(dataset, sku or "", _SKU_COLUMNS)
    if sku_filter is not None:
        filters.append(sku_filter)

    barcode_filter = _build_equality_filter(dataset, barcode or "", _BARCODE_COLUMNS)
    if barcode_filter is not None:
        filters.append(barcode_filter)

    category_filter = _build_equality_filter(dataset, category or "", _CATEGORY_COLUMNS)
    if category_filter is not None:
        filters.append(category_filter)

    filter_expression = _combine_filters(filters)

    dataframes: List[pd.DataFrame] = []
    try:
        scanner = dataset.scanner(filter=filter_expression)
        for batch in scanner.to_batches():
            chunk = batch.to_pandas()
            if chunk.empty:
                continue
            chunk = _filter_contains(chunk, text or "", _TEXT_COLUMNS)
            if chunk.empty:
                continue
            if category and category_filter is None:
                chunk = _filter_contains(chunk, category or "", _CATEGORY_COLUMNS)
                if chunk.empty:
                    continue
            dataframes.append(chunk)
    except Exception:
        return 0, []

    if not dataframes:
        return 0, []

    df = pd.concat(dataframes, ignore_index=True)

    ascending = order_dir.lower() != "desc"
    if order_by in df.columns:
        try:
            df = df.sort_values(
                by=order_by,
                ascending=ascending,
                kind="mergesort",
                key=lambda series: series.astype(str).str.lower()
                if series.dtype == object
                else series,
            )
        except Exception:
            df = df.sort_values(by=order_by, ascending=ascending, kind="mergesort")

    page = max(page, 1)
    page_size = max(page_size, 1)
    total = int(df.shape[0])
    start = (page - 1) * page_size
    end = start + page_size

    slice_df = df.iloc[start:end].copy()
    slice_df = slice_df.where(pd.notnull(slice_df), None)
    items = slice_df.to_dict("records")
    return total, items
