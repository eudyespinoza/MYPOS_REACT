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
  codigo_postal?: string;
  AddressZipCode?: string;
  ciudad?: string;
  AddressCity?: string;
  estado?: string;
  AddressState?: string;
  condado?: string;
  AddressCounty?: string;
  CountyName?: string;
  calle?: string;
  AddressStreet?: string;
  altura?: string;
  AddressStreetNumber?: string;
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
