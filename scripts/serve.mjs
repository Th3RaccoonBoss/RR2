import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHandler } from '../api/diagnostic.mjs';
// Local mock is deliberately incapable of accessing the real runner or process
// environment. It renders disabled status even if the shell contains secrets.
const handler = createHandler({ env: { VERCEL:'1', VERCEL_ENV:'preview', VERCEL_URL:'offline.vercel.app' },
  runner: async () => { throw new Error('local_execution_forbidden'); },
  inspector: async () => { throw new Error('local_execution_forbidden'); } });
const files = new Map([['/', ['index.html', 'text/html']], ['/app.js', ['app.js', 'text/javascript']], ['/style.css', ['style.css', 'text/css']], ['/robots.txt', ['robots.txt', 'text/plain']]]);
const server = createServer(async (req, res) => {
  if (req.url === '/api/diagnostic') return handler(req, res);
  const file = files.get(req.url);
  if (!file || req.method !== 'GET') { res.writeHead(404); return res.end(); }
  try { const bytes = await readFile(new URL(`../public/${file[0]}`, import.meta.url)); res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control':'no-store' }); res.end(bytes); }
  catch { res.writeHead(500); res.end('Unavailable'); }
});
server.listen(3038, '127.0.0.1', () => process.stdout.write('Offline-only mock: http://127.0.0.1:3038 (database execution disabled)\n'));
