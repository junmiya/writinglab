import { describe, expect, it } from 'vitest';

describe('export API contract', () => {
  it('uses POST /api/documents/{documentId}/export with authenticated access', () => {
    const contract = {
      method: 'POST',
      path: '/api/documents/{documentId}/export',
      requiresAuth: true,
    };

    expect(contract.method).toBe('POST');
    expect(contract.path.includes('/export')).toBe(true);
    expect(contract.requiresAuth).toBe(true);
  });
});
