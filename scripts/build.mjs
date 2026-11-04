import { readFile, readdir, mkdir, copyFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
if ((process.env.VERCEL || process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== 'preview') {
  throw new Error('Build refused: this diagnostic can only be deployed to Preview.');
}
if (process.env.VERCEL === '1') {
  // A real Vercel build must include the pinned driver. Offline checks need no
  // dependency installation, and are not evidence of a successfully packaged driver.
  const require = createRequire(import.meta.url);
  const driver = JSON.parse(await readFile(require.resolve('pg/package.json'), 'utf8'));
  if (driver.version !== '8.16.3') throw new Error('The pinned PostgreSQL driver is required.');
}
const manifest = JSON.parse(await readFile(resolve(root, 'vendor-manifest.json'), 'utf8'));
if ((await readdir(resolve(root, 'api'))).sort().join(',') !== 'diagnostic.mjs') {
  throw new Error('Unexpected API route. Upload the exact standalone tree, never overlay it onto the website.');
}
for (const [file, expected] of Object.entries(manifest.sha256)) {
  if (!file.startsWith('vendor/') || file.includes('..')) throw new Error('Invalid vendor manifest path.');
  const actual = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
  if (actual !== expected) throw new Error('Vendored diagnostic source changed. Refresh explicitly; do not fork the validation logic.');
}
// Recreate only this candidate's generated output, so a stale quote page or API
// fallback cannot ride along from an earlier local build.
await rm(resolve(root, 'dist'), { recursive: true, force: true });
await mkdir(resolve(root, 'dist'), { recursive: true });
for (const name of await readdir(resolve(root, 'public'))) {
  if (!['index.html', 'app.js', 'style.css', 'robots.txt'].includes(name)) throw new Error('Unexpected public artifact.');
  await copyFile(resolve(root, 'public', name), resolve(root, 'dist', name));
}
process.stdout.write('Offline static build and vendored-source integrity check passed. No credentials or network used.\n');
