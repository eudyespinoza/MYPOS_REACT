const STORES_SCRIPT_ID = 'backend-stores-data';
const LAST_STORE_SCRIPT_ID = 'backend-last-store-data';

export type BootstrapData = {
  stores: string[] | null;
  lastStoreId: string | null;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const readScriptContent = (id: string): string | null => {
  if (typeof document === 'undefined') return null;
  const element = document.getElementById(id);
  if (!element) return null;
  const content = element.textContent?.trim();
  return content && content.length > 0 ? content : null;
};

const parseJson = (content: string | null): unknown => {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch (error) {
    console.warn(`No se pudo parsear el script bootstrap: ${content.slice(0, 40)}...`, error);
    return null;
  }
};

const extractStores = (value: unknown): string[] | null => {
  if (isStringArray(value)) return value;
  if (typeof value === 'object' && value !== null) {
    const candidate =
      (value as Record<string, unknown>).stores ??
      (value as Record<string, unknown>).available_stores ??
      (value as Record<string, unknown>).stores_available;
    if (isStringArray(candidate)) return candidate;
  }
  return null;
};

const extractLastStoreId = (value: unknown): string | null => {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'object' && value !== null) {
    const candidate =
      (value as Record<string, unknown>).last_store ??
      (value as Record<string, unknown>).lastStore ??
      (value as Record<string, unknown>).id;
    if (typeof candidate === 'string' && candidate) return candidate;
  }
  return null;
};

let cachedData: BootstrapData | null = null;

export const getBootstrapData = (): BootstrapData => {
  if (cachedData) return cachedData;

  const storesPayload = parseJson(readScriptContent(STORES_SCRIPT_ID));
  const lastStorePayload = parseJson(readScriptContent(LAST_STORE_SCRIPT_ID));

  const stores = extractStores(storesPayload);
  const lastStoreId = extractLastStoreId(lastStorePayload);

  cachedData = {
    stores,
    lastStoreId,
  };

  return cachedData;
};
