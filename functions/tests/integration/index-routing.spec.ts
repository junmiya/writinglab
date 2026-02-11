import { beforeEach, describe, expect, it } from 'vitest';

import { routeApiRequest } from '../../src/index';

describe('index routing', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai';
    process.env.GEMINI_API_KEY = 'test-gemini';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic';
  });

  it('returns service health without auth', async () => {
    const response = await routeApiRequest({
      method: 'GET',
      path: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
      }),
    );
  });

  it('requires auth for protected routes', async () => {
    const response = await routeApiRequest({
      method: 'POST',
      path: '/api/advice/generate',
      body: {},
    });

    expect(response.statusCode).toBe(401);
  });

  it('routes advice generation with header-based auth', async () => {
    const response = await routeApiRequest({
      method: 'POST',
      path: '/api/advice/generate',
      headers: { 'x-user-id': 'user-1', 'x-correlation-id': 'corr-1' },
      body: {
        documentId: 'doc-1',
        synopsis: 'short synopsis',
        content: 'main story content',
        panelAProvider: 'gemini',
        panelBProvider: 'openai',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        panelA: expect.objectContaining({ provider: 'gemini' }),
        panelB: expect.objectContaining({ provider: 'openai' }),
      }),
    );
  });

  it('routes document create/list/get/update with ownership and version checks', async () => {
    const createResponse = await routeApiRequest({
      method: 'POST',
      path: '/api/documents',
      headers: { 'x-user-id': 'owner-1', 'x-correlation-id': 'corr-doc' },
      body: {
        title: 'Draft 1',
        authorName: 'Writer A',
        settings: { lineLength: 20, pageCount: 10 },
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.body as { id: string; version: number };
    expect(created.id.startsWith('doc_')).toBe(true);
    expect(created.version).toBe(1);

    const listResponse = await routeApiRequest({
      method: 'GET',
      path: '/api/documents',
      headers: { 'x-user-id': 'owner-1' },
    });
    expect(listResponse.statusCode).toBe(200);
    const list = listResponse.body as Array<{ id: string }>;
    expect(list.some((item) => item.id === created.id)).toBe(true);

    const getForbidden = await routeApiRequest({
      method: 'GET',
      path: `/api/documents/${created.id}`,
      headers: { 'x-user-id': 'owner-2' },
    });
    expect(getForbidden.statusCode).toBe(403);

    const conflict = await routeApiRequest({
      method: 'PATCH',
      path: `/api/documents/${created.id}`,
      headers: { 'x-user-id': 'owner-1' },
      body: {
        synopsis: 'update attempt',
        expectedVersion: 999,
      },
    });
    expect(conflict.statusCode).toBe(409);

    const updateResponse = await routeApiRequest({
      method: 'PATCH',
      path: `/api/documents/${created.id}`,
      headers: { 'x-user-id': 'owner-1' },
      body: {
        synopsis: 'updated synopsis',
        content: 'updated content',
        expectedVersion: 1,
      },
    });
    expect(updateResponse.statusCode).toBe(200);
    const updated = updateResponse.body as { synopsis: string; version: number };
    expect(updated.synopsis).toBe('updated synopsis');
    expect(updated.version).toBe(2);
  });

  it('routes export endpoint', async () => {
    const response = await routeApiRequest({
      method: 'POST',
      path: '/api/documents/doc-42/export',
      headers: { 'x-user-id': 'user-1' },
      body: {
        title: 'My Script',
        authorName: 'Writer',
        content: 'Body text',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        fileName: 'My_Script.docx',
      }),
    );
  });
});
