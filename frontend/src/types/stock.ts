export interface StockRowResponse {
  almacen?: string;
  almacen_nombre?: string;
  warehouse?: string;
  Warehouse?: string;
  store?: string;
  disponible_venta?: number | string;
  stock_venta?: number | string;
  disponible?: number | string;
  disponible_entrega?: number | string;
  disponible_ent?: number | string;
  comprometido?: number | string;
  reservado?: number | string;
}

export interface StockRow {
  storeName: string;
  availableForSale: number;
  availableForDelivery: number;
  committed: number;
}
