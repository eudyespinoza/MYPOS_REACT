export interface ProductResponse {
  numero_producto?: string | number;
  productId?: string | number;
  id?: string | number;
  nombre_producto?: string;
  productName?: string;
  nombre?: string;
  descripcion?: string;
  descripcion_corta?: string;
  categoria_producto?: string;
  categoria?: string;
  precio_final_con_descuento?: number | string;
  precio_final_con_iva?: number | string;
  precio?: number | string;
  iva?: number | string;
  pesoKg?: number | string;
  total_disponible_venta?: number | string;
  stock?: number | string;
  grupo_cobertura?: string;
  barcode?: string;
  codigo_barras?: string;
  multiplo?: number | string;
  unidad_medida?: string;
  unidad?: string;
  marca?: string;
  brand?: string;
  imagen_url?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  iva: number;
  stock: number;
  weightKg: number;
  unit: string;
  multiple: number;
  coverageGroup?: string;
  barcode?: string;
  brand?: string;
  imageUrl?: string | null;
}
