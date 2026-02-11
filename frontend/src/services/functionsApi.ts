import { readSession } from './authService';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getFunctionsBaseUrl(): string {
  const configured = import.meta.env.VITE_FUNCTIONS_BASE_URL;
  if (!configured) {
    return '';
  }

  return trimTrailingSlash(configured.trim());
}

export function isFunctionsApiConfigured(): boolean {
  return getFunctionsBaseUrl().length > 0;
}

function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `corr-${Date.now()}`;
}

function buildHeaders(): Record<string, string> {
  const session = readSession();
  return {
    'content-type': 'application/json',
    'x-user-id': session?.user.uid ?? 'local-dev-user',
    'x-correlation-id': createCorrelationId(),
  };
}

interface ApiErrorShape {
  error?: string;
}

function readApiError(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const candidate = body as ApiErrorShape;
  return typeof candidate.error === 'string' ? candidate.error : null;
}

type HttpMethod = 'GET' | 'POST' | 'PATCH';

export async function requestFunctionsJson<TResponse>(
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<TResponse> {
  const baseUrl = getFunctionsBaseUrl();
  if (!baseUrl) {
    throw new Error('FUNCTIONS_BASE_URL_NOT_CONFIGURED');
  }

  const headers = buildHeaders();
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
  });

  const parsed = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(readApiError(parsed) ?? `HTTP_${response.status}`);
  }

  return parsed as TResponse;
}

export async function postFunctionsJson<TResponse>(
  path: string,
  body: unknown,
): Promise<TResponse> {
  return requestFunctionsJson<TResponse>('POST', path, body);
}
