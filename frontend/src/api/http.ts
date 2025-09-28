import { getCsrfToken } from '@/utils/csrf';

export class ApiError extends Error {
  public readonly status: number;
  public readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  parseAs?: 'json' | 'text' | 'blob';
  body?: unknown;
};

const parseResponse = async (response: Response, parseAs: RequestOptions['parseAs']) => {
  if (parseAs === 'text') return response.text();
  if (parseAs === 'blob') return response.blob();
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

const isBodyInit = (value: unknown): value is BodyInit => {
  if (value instanceof FormData || value instanceof Blob || value instanceof URLSearchParams) return true;
  if (value instanceof ArrayBuffer) return true;
  if (ArrayBuffer.isView(value)) return true;
  if (typeof value === 'string') return true;
  return false;
};

export const request = async <T = unknown>(input: string, options: RequestOptions = {}): Promise<T> => {
  const { parseAs = 'json', headers, method, body, ...rest } = options;
  const init: RequestInit = {
    ...rest,
    headers: {
      ...(headers ?? {}),
    },
    credentials: rest.credentials ?? 'include',
  };

  const needsCsrf = method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  if (needsCsrf) {
    const token = getCsrfToken();
    if (token) {
      init.headers = {
        'X-CSRFToken': token,
        ...init.headers,
      };
    }
  }

  if (body !== undefined && body !== null) {
    if (isBodyInit(body)) {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      init.headers = {
        'Content-Type': 'application/json',
        ...init.headers,
      };
    }
  }

  if (needsCsrf && init.body && init.headers && !(init.body instanceof FormData) && !('Content-Type' in init.headers)) {
    init.headers = {
      'Content-Type': 'application/json',
      ...init.headers,
    };
  }

  const response = await fetch(input, { ...init, method });
  const payload = await parseResponse(response, parseAs);

  if (!response.ok) {
    const message = typeof payload === 'string' && payload ? payload : response.statusText || 'Request failed';
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
};

export const get = <T = unknown>(url: string, options?: RequestOptions) =>
  request<T>(url, { ...options, method: 'GET', body: undefined });

export const post = <T = unknown>(url: string, data?: unknown, options?: RequestOptions) =>
  request<T>(url, { ...options, method: 'POST', body: data });

export const put = <T = unknown>(url: string, data?: unknown, options?: RequestOptions) =>
  request<T>(url, { ...options, method: 'PUT', body: data });

export const del = <T = unknown>(url: string, options?: RequestOptions) =>
  request<T>(url, { ...options, method: 'DELETE', body: undefined });
