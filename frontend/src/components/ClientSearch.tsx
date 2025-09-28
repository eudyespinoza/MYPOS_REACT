import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Client, ClientResponse } from '@/types/client';
import { searchClients, createClient } from '@/api/clients';
import type { ClientPayload } from '@/api/clients';
import { queryKeys } from '@/api/queryKeys';
import { useToastStore } from '@/stores/useToastStore';
import { normalizeClient } from '@/utils/normalizers';
import { ApiError } from '@/api/http';
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
  dni: string;
  codigo_postal: string;
  ciudad: string;
  estado: string;
  condado: string;
  calle: string;
  altura: string;
}

const defaultForm: NewClientForm = {
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  dni: '',
  codigo_postal: '',
  ciudad: '',
  estado: '',
  condado: '',
  calle: '',
  altura: '',
};

const requiredFields: (keyof NewClientForm)[] = [
  'nombre',
  'apellido',
  'email',
  'telefono',
  'dni',
  'codigo_postal',
  'ciudad',
  'estado',
  'condado',
  'calle',
  'altura',
];

const cleanString = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : '';
  }
  if (value == null) return '';
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : '';
};

const firstNonEmpty = (...values: unknown[]): string => {
  for (const value of values) {
    const cleaned = cleanString(value);
    if (cleaned) return cleaned;
  }
  return '';
};

const splitFullName = (value: string): { firstName: string; lastName: string } => {
  const parts = value.split(/\s+/u).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const parseAddressParts = (value: string): { street: string; number: string } => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+?)\s+(\d+[^\s,]*)$/u);
  if (match) {
    return { street: match[1].trim(), number: match[2].trim() };
  }
  return { street: trimmed, number: '' };
};

const buildFormFromClientResponse = (client: ClientResponse): Partial<NewClientForm> => {
  const composedName = firstNonEmpty(
    client.nombre_cliente,
    client.nombre_completo,
    client.full_name,
    client.display_name,
    client.razon_social,
  );

  let nombre = firstNonEmpty(client.nombre);
  let apellido = firstNonEmpty(client.apellido);

  if (!nombre && composedName) {
    const parts = splitFullName(composedName);
    nombre = parts.firstName;
    if (!apellido) {
      apellido = parts.lastName;
    }
  }

  const email = firstNonEmpty(client.email);
  const telefono = firstNonEmpty(client.telefono, client.phone);
  const dni = firstNonEmpty(client.dni, client.doc, client.nif, client.cuit, client.numero_cliente);
  const codigo_postal = firstNonEmpty(client.codigo_postal, client.AddressZipCode);
  const ciudad = firstNonEmpty(client.ciudad, client.AddressCity);
  const estado = firstNonEmpty(client.estado, client.AddressState);
  const condado = firstNonEmpty(client.condado, client.AddressCounty, client.CountyName);
  let calle = firstNonEmpty(client.calle, client.AddressStreet);
  let altura = firstNonEmpty(client.altura, client.AddressStreetNumber);

  const fallbackAddress = firstNonEmpty(client.direccion_completa, client.direccion, client.address);
  if (fallbackAddress && (!calle || !altura)) {
    const parsed = parseAddressParts(fallbackAddress);
    if (!calle && parsed.street) {
      calle = parsed.street;
    }
    if (!altura && parsed.number) {
      altura = parsed.number;
    }
  }

  const data: Partial<NewClientForm> = {};
  if (nombre) data.nombre = nombre;
  if (apellido) data.apellido = apellido;
  if (email) data.email = email;
  if (telefono) data.telefono = telefono;
  if (dni) data.dni = dni;
  if (codigo_postal) data.codigo_postal = codigo_postal;
  if (ciudad) data.ciudad = ciudad;
  if (estado) data.estado = estado;
  if (condado) data.condado = condado;
  if (calle) data.calle = calle;
  if (altura) data.altura = altura;

  return data;
};

const mergeFormWithClient = (
  form: NewClientForm,
  client: ClientResponse,
  override = false,
): NewClientForm => {
  const candidate = buildFormFromClientResponse(client);
  let changed = false;
  const next: NewClientForm = { ...form };

  (Object.entries(candidate) as [keyof NewClientForm, string][]).forEach(([key, value]) => {
    if (!value) return;
    if (override || !form[key].trim()) {
      if (next[key] !== value) {
        next[key] = value;
        changed = true;
      }
    }
  });

  return changed ? next : form;
};

const isFormDirty = (form: NewClientForm): boolean =>
  Object.values(form).some((value) => value.trim().length > 0);

const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const ClientSearch = ({ open, onClose, onSelect }: Props) => {
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<NewClientForm>(defaultForm);
  const queryClient = useQueryClient();
  const pushToast = useToastStore((state) => state.pushToast);

  const normalizedQuery = query.trim();

  const {
    data: rawResults = [],
    isFetching,
    error: queryError,
  } = useQuery<ClientResponse[]>({
    queryKey: queryKeys.clients(normalizedQuery),
    queryFn: () => searchClients(normalizedQuery),
    enabled: open && normalizedQuery.length > 2,
    initialData: [] as ClientResponse[],
  });

  useEffect(() => {
    if (!queryError) return;
    const description =
      queryError instanceof Error ? queryError.message : 'Reintenta en unos segundos.';
    pushToast({ tone: 'warning', title: 'No se pudo buscar clientes', description });
  }, [pushToast, queryError]);

  const normalizedResults = useMemo<Client[]>(() => rawResults.map(normalizeClient), [rawResults]);

  useEffect(() => {
    if (!open) return;
    if (!rawResults.length) return;
    setForm((prev) => {
      if (isFormDirty(prev)) return prev;
      return mergeFormWithClient(prev, rawResults[0]);
    });
  }, [rawResults, open]);

  const handleApiValidationError = (error: ApiError): boolean => {
    const payload = error.payload;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const record = payload as Record<string, unknown>;
      const errors = record.errors;
      let handled = false;
      if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
        for (const [field, detail] of Object.entries(errors as Record<string, unknown>)) {
          const messages = Array.isArray(detail) ? detail : [detail];
          messages.forEach((message) => {
            pushToast({
              tone: 'error',
              title: `Error en ${field}`,
              description: typeof message === 'string' ? message : error.message,
            });
            handled = true;
          });
        }
      }
      if (handled) return true;

      const general = record.error;
      if (typeof general === 'string' && general) {
        const fieldMatch = general.match(/campo\s+([a-zA-Z_]+)/iu);
        pushToast({
          tone: 'error',
          title: fieldMatch ? `Error en ${fieldMatch[1]}` : 'No se pudo crear el cliente',
          description: general,
        });
        return true;
      }
    }
    return false;
  };

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients(normalizedQuery) });
      onSelect(client);
      setForm(defaultForm);
      setQuery('');
      onClose();
      pushToast({ tone: 'success', title: 'Cliente creado', description: client.name });
    },
    onError: (error) => {
      if (error instanceof ApiError && handleApiValidationError(error)) {
        return;
      }
      pushToast({
        tone: 'error',
        title: 'No se pudo crear el cliente',
        description: error instanceof Error ? error.message : 'Revisa los datos ingresados.',
      });
    },
  });

  const canSubmit = useMemo(() => {
    const trimmed = (field: keyof NewClientForm) => form[field].trim();
    if (!requiredFields.every((field) => trimmed(field))) return false;
    if (!emailRegex.test(trimmed('email'))) return false;
    const digits = form.telefono.replace(/\D+/g, '');
    if (digits.length < 6) return false;
    return true;
  }, [form]);

  const handleSelect = (client: Client) => {
    onSelect(client);
    setForm(defaultForm);
    setQuery('');
    onClose();
    pushToast({ tone: 'info', title: 'Cliente seleccionado', description: client.name });
  };

  const handlePrefill = (client: ClientResponse, override = false) => {
    let changed = false;
    setForm((prev) => {
      const next = mergeFormWithClient(prev, client, override);
      changed = next !== prev;
      return next;
    });
    if (changed) {
      pushToast({
        tone: 'info',
        title: 'Formulario actualizado',
        description: 'Se completaron los campos con los datos del cliente seleccionado.',
      });
    } else if (override) {
      pushToast({
        tone: 'warning',
        title: 'Sin cambios',
        description: 'Los datos del cliente ya estaban cargados en el formulario.',
      });
    }
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
            ) : normalizedResults.length ? (
              <ul className="divide-y divide-slate-800">
                {normalizedResults.map((client, index) => {
                  const raw = rawResults[index];
                  if (!raw) return null;
                  return (
                    <li key={client.id} className="bg-slate-900">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-slate-800"
                          onClick={() => handleSelect(client)}
                        >
                          <span className="font-semibold">{client.name}</span>
                          <span className="text-xs text-slate-400">{client.document ?? '—'}</span>
                          {client.email ? <span className="text-xs text-slate-400">{client.email}</span> : null}
                        </button>
                        <div className="flex justify-end border-t border-slate-800 px-4 py-2">
                          <button
                            type="button"
                            className="text-xs font-medium text-primary-300 transition hover:text-primary-200"
                            onClick={() => handlePrefill(raw, true)}
                          >
                            Usar datos en el formulario
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-4 text-center text-sm text-slate-400">Sin resultados.</div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <header className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-100">Crear nuevo</h3>
            <p className="text-xs text-slate-400">
              Campos obligatorios: nombre, apellido, DNI, email, teléfono, código postal, ciudad, estado, condado, calle y altura.
            </p>
          </header>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit || createMutation.isPending) return;

              const payload: ClientPayload = {
                nombre: form.nombre.trim(),
                apellido: form.apellido.trim(),
                email: form.email.trim(),
                telefono: form.telefono.trim(),
                dni: form.dni.trim(),
                codigo_postal: form.codigo_postal.trim(),
                ciudad: form.ciudad.trim(),
                estado: form.estado.trim(),
                condado: form.condado.trim(),
                calle: form.calle.trim(),
                altura: form.altura.trim(),
              };

              createMutation.mutate(payload);
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
                  minLength={2}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Apellido *</label>
                <input
                  type="text"
                  value={form.apellido}
                  onChange={(event) => setForm((prev) => ({ ...prev, apellido: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  required
                  minLength={2}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">DNI / Documento *</label>
                <input
                  type="text"
                  value={form.dni}
                  onChange={(event) => setForm((prev) => ({ ...prev, dni: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Teléfono *</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(event) => setForm((prev) => ({ ...prev, telefono: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Código postal *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.codigo_postal}
                  onChange={(event) => setForm((prev) => ({ ...prev, codigo_postal: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Ciudad *</label>
                <input
                  type="text"
                  value={form.ciudad}
                  onChange={(event) => setForm((prev) => ({ ...prev, ciudad: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Estado / Provincia *</label>
                <input
                  type="text"
                  value={form.estado}
                  onChange={(event) => setForm((prev) => ({ ...prev, estado: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Condado *</label>
              <input
                type="text"
                value={form.condado}
                onChange={(event) => setForm((prev) => ({ ...prev, condado: event.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-1">
                <label className="text-xs text-slate-400">Calle *</label>
                <input
                  type="text"
                  value={form.calle}
                  onChange={(event) => setForm((prev) => ({ ...prev, calle: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Altura *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.altura}
                  onChange={(event) => setForm((prev) => ({ ...prev, altura: event.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>
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
