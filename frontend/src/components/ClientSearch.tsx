import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Client } from '@/types/client';
import { searchClients, createClient, ClientPayload } from '@/api/clients';
import { queryKeys } from '@/api/queryKeys';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (client: Client) => void;
}

interface NewClientForm {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  doc: string;
  direccion: string;
}

const defaultForm: NewClientForm = {
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  doc: '',
  direccion: '',
};

export const ClientSearch = ({ open, onClose, onSelect }: Props) => {
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<NewClientForm>(defaultForm);
  const queryClient = useQueryClient();

  const { data: results, isFetching } = useQuery({
    queryKey: queryKeys.clients(query),
    queryFn: () => searchClients(query),
    enabled: open && query.trim().length > 2,
    initialData: [] as Client[],
  });

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients(query) });
      onSelect(client);
      setForm(defaultForm);
      onClose();
    },
  });

  const canSubmit = useMemo(() => form.nombre.trim().length >= 2, [form.nombre]);

  const handleSelect = (client: Client) => {
    onSelect(client);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Clientes" size="lg">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3">
          <header className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-100">Buscar existente</h3>
            <p className="text-xs text-slate-400">Escribe al menos 3 caracteres.</p>
          </header>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, documento, email..."
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
          />
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800">
            {isFetching ? (
              <div className="p-4 text-center text-sm text-slate-300">Buscando clientes...</div>
            ) : results && results.length ? (
              <ul className="divide-y divide-slate-800">
                {results.map((client) => (
                  <li key={client.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-1 bg-slate-900 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-slate-800"
                      onClick={() => handleSelect(client)}
                    >
                      <span className="font-semibold">{client.name}</span>
                      <span className="text-xs text-slate-400">{client.document ?? '—'}</span>
                      {client.email ? <span className="text-xs text-slate-400">{client.email}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-sm text-slate-400">Sin resultados.</div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <header className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-100">Crear nuevo</h3>
            <p className="text-xs text-slate-400">Campos mínimos: nombre.</p>
          </header>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit) return;
              createMutation.mutate(form as ClientPayload);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Apellido</label>
                <input
                  type="text"
                  value={form.apellido}
                  onChange={(event) => setForm((prev) => ({ ...prev, apellido: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Documento</label>
                <input
                  type="text"
                  value={form.doc}
                  onChange={(event) => setForm((prev) => ({ ...prev, doc: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Teléfono</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(event) => setForm((prev) => ({ ...prev, telefono: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(event) => setForm((prev) => ({ ...prev, direccion: event.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500"
                onClick={() => setForm(defaultForm)}
              >
                Limpiar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-primary-400 disabled:opacity-60"
                disabled={!canSubmit || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creando...' : 'Crear y seleccionar'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Modal>
  );
};
