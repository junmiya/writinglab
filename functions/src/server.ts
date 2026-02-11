import { createServer } from 'node:http';

import { createNodeHttpHandler } from './index';

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = '0.0.0.0';

function readPort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_PORT;
  }

  return parsed;
}

const port = readPort(process.env.PORT);
const host = process.env.HOST || DEFAULT_HOST;
const handler = createNodeHttpHandler();

const server = createServer((req, res) => {
  void handler(req, res);
});

server.listen(port, host, () => {
  // Log destination once so local development startup is obvious.
  // eslint-disable-next-line no-console
  console.log(`Functions API listening on http://${host}:${port}`);
});
