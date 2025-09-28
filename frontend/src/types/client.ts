export interface ClientResponse {
  numero_cliente?: string | number;
  id?: string | number;
  nombre_completo?: string;
  nombre_cliente?: string;
  full_name?: string;
  display_name?: string;
  razon_social?: string;
  nombre?: string;
  apellido?: string;
  doc?: string;
  dni?: string;
  nif?: string;
  cuit?: string;
  email?: string;
  telefono?: string;
  phone?: string;
  direccion?: string;
  direccion_completa?: string;
  address?: string;
  store_preferida?: string;
}

export interface Client {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  preferredStoreId?: string;
}
