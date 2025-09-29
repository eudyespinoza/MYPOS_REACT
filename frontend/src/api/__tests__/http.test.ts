import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

describe('http client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch;
    }

    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      delete (globalThis as typeof globalThis & { window?: typeof window }).window;
    }
  });

  it('uses the configured backend URL even if the hostname has no dots', async () => {
    vi.stubEnv('VITE_BACKEND_URL', 'http://web:8000');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ ok: true }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { get } = await import('../http');

    await get('/api/test');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://web:8000/api/test');
  });

  it('falls back to the browser origin when running on localhost', async () => {
    vi.stubEnv('VITE_BACKEND_URL', 'http://web:8000');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ ok: true }),
    });

    const fakeWindow = {
      location: {
        origin: 'http://localhost:3000',
        hostname: 'localhost',
      },
    } as unknown as Window & typeof globalThis;

    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('fetch', fetchMock);

    const { get } = await import('../http');

    await get('/api/test');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/api/test');
  });
});
