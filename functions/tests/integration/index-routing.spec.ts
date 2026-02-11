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
