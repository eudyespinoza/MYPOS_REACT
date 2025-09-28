import { get, post } from './http';
import { normalizeClient } from '@/utils/normalizers';
import type { Client, ClientResponse } from '@/types/client';

export const searchClients = async (query: string): Promise<Client[]> => {
  if (!query) return [];
  const data = await get<ClientResponse[]>(`/api/clientes/search?query=${encodeURIComponent(query)}`);
  if (!Array.isArray(data)) return [];
  return data.map(normalizeClient);
};

export interface ClientPayload {
  nombre: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  doc?: string;
  direccion?: string;
  [key: string]: unknown;
}

export const createClient = async (payload: ClientPayload): Promise<Client> => {
  const data = await post<ClientResponse>('/api/clientes/create', payload);
  return normalizeClient(data ?? {});
};

export const validateClient = async (payload: Record<string, unknown>): Promise<unknown> => {
  return post('/api/clientes/validate', payload);
};
