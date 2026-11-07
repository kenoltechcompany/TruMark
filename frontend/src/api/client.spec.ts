import { describe, it, expect, beforeEach, mock } from 'bun:test';
import apiClient from './client';

describe('apiClient', () => {
  beforeEach(() => {
    // Mock global localStorage
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {},
      length: 0,
      key: () => null,
    };
  });

  it('has base URL set to /api', () => {
    expect(apiClient.defaults.baseURL).toBe('/api');
  });

  it('attaches Authorization header when token exists', async () => {
    localStorage.setItem('token', 'sample-jwt-token');

    // Run the request interceptor handler
    const interceptor = (apiClient.interceptors.request as any).handlers[0];
    const config = await interceptor.fulfilled({ headers: {} });

    expect(config.headers.Authorization).toBe('Bearer sample-jwt-token');
  });

  it('does not attach Authorization header when token is missing', async () => {
    const interceptor = (apiClient.interceptors.request as any).handlers[0];
    const config = await interceptor.fulfilled({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });
});
