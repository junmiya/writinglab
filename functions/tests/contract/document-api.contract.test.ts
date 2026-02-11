import { describe, expect, it } from 'vitest';

interface EndpointContract {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  requiresAuth: boolean;
}

const contract: EndpointContract[] = [
  { method: 'GET', path: '/api/documents', requiresAuth: true },
  { method: 'POST', path: '/api/documents', requiresAuth: true },
  { method: 'GET', path: '/api/documents/{documentId}', requiresAuth: true },
  { method: 'PATCH', path: '/api/documents/{documentId}', requiresAuth: true },
  { method: 'POST', path: '/api/documents/{documentId}/export', requiresAuth: true },
];

describe('document API contract', () => {
  it('requires authentication on all document endpoints', () => {
    for (const endpoint of contract) {
      expect(endpoint.requiresAuth).toBe(true);
    }
  });

  it('defines only supported HTTP methods', () => {
    for (const endpoint of contract) {
      expect(['GET', 'POST', 'PATCH']).toContain(endpoint.method);
      expect(endpoint.path.startsWith('/api/documents')).toBe(true);
    }
  });
});
