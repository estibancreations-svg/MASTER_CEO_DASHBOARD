import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import express from 'express';

import assemble from './api/visionweaver-assemble.js';
import continuity from './api/visionweaver-continuity.js';

const dist = fileURLToPath(new URL('./dist/', import.meta.url));
const index = fileURLToPath(new URL('./dist/index.html', import.meta.url));

await access(index);

const app = express();
app.disable('x-powered-by');

app.get('/healthz', (_request, response) => {
  response.set('Cache-Control', 'no-store').json({ ok: true });
});

app.use('/api', (_request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

const parseJson = express.json({ limit: '64kb' });
for (const [route, handler] of [
  ['/api/visionweaver-assemble', assemble],
  ['/api/visionweaver-continuity', continuity]
]) {
  app.all(route, parseJson, handler);
}

app.use('/api', (_request, response) => {
  response.status(404).json({ ok: false, error: 'api_route_not_found' });
});

app.use(express.static(dist));
app.get(/.*/, (_request, response) => response.sendFile(index));

app.use((error, _request, response, next) => {
  if (response.headersSent) return next(error);
  const status = error.status === 400 || error.status === 413 ? error.status : 500;
  const code = { 400: 'invalid_json', 413: 'request_too_large', 500: 'internal_error' };
  return response.status(status).json({ ok: false, error: code[status] });
});

const port = Number(process.env.PORT ?? 10000);
app.listen(port, '0.0.0.0', () => {
  console.log('Dashboard listening on port %d', port);
});
