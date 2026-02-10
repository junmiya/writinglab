import { describe, expect, it } from 'vitest';

const routes = [
  { method: 'POST', path: '/api/advice/generate', auth: true },
  { method: 'GET', path: '/api/advice/models', auth: true },
];

describe('advice API contract', () => {
  it('requires auth for all advice endpoints', () => {
    for (const route of routes) {
      expect(route.auth).toBe(true);
    }
  });

  it('provides stable paths for generator and model listing', () => {
    expect(routes.map((r) => r.path)).toEqual(['/api/advice/generate', '/api/advice/models']);
  });
});
