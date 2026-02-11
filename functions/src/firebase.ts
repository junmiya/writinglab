import { onRequest } from 'firebase-functions/v2/https';

import { routeApiRequest } from './index';

function normalizeHeaders(
  input: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(input)) {
    headers[key] = Array.isArray(value) ? value[0] : value;
  }
  return headers;
}

function readBody(body: unknown, rawBody: Buffer | undefined): unknown {
  if (body !== undefined) {
    return body;
  }

  if (!rawBody || rawBody.length === 0) {
    return {};
  }

  const text = rawBody.toString('utf8');
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

export const api = onRequest(
  {
    region: process.env.FUNCTIONS_REGION || 'us-central1',
    cors: true,
  },
  async (req, res) => {
    try {
      const response = await routeApiRequest({
        method: req.method,
        path: req.originalUrl || req.url || '/',
        headers: normalizeHeaders(req.headers),
        body: readBody(req.body, req.rawBody),
      });

      if (response.headers) {
        for (const [key, value] of Object.entries(response.headers)) {
          res.setHeader(key, value);
        }
      }

      res.status(response.statusCode).send(response.body);
    } catch {
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  },
);
