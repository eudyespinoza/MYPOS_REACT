import { get, post } from './http';
import { normalizeClient } from '@/utils/normalizers';
import type { Client, ClientResponse } from '@/types/client';

export const searchClients = async (query: string): Promise<ClientResponse[]> => {
  if (!query) return [];
  const data = await get<ClientResponse[]>(`/api/clientes/search?query=${encodeURIComponent(query)}`);
  if (!Array.isArray(data)) return [];
  return data;
};

export interface ClientPayload {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  dni: string;
  codigo_postal: string;
  ciudad: string;
  estado: string;
  condado: string;
  calle: string;
  altura: string;
}

export const createClient = async (payload: ClientPayload): Promise<Client> => {
  const data = await post<ClientResponse>('/api/clientes/create', payload);
  return normalizeClient(data ?? {});
};

export const validateClient = async (payload: Record<string, unknown>): Promise<unknown> => {
  return post('/api/clientes/validate', payload);
};
