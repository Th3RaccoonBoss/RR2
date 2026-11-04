import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { createGzip } from "node:zlib";
import { legacyRedirects } from "../src/legacy-routes.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const publicRoot = join(root, "dist");
const port = Number(process.env.PORT || 4173);
const mime = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
};

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const legacyRedirect = legacyRedirects.find(
    ({ source }) => source === pathname
  );

  if (legacyRedirect) {
    response.statusCode = legacyRedirect.status;
    response.setHeader("Location", legacyRedirect.destination);
    response.end();
    return;
  }

  const safePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(publicRoot, safePath);

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, "index.html");
    await access(filePath);
  } catch {
    filePath = join(publicRoot, "404.html");
    response.statusCode = 404;
  }

  const type = mime[extname(filePath)] || "application/octet-stream";
  response.setHeader("Content-Type", type);
  response.setHeader("X-Content-Type-Options", "nosniff");

  // Static hosts targeted by this build (see _headers/_redirects) compress
  // text responses; the preview mirrors that so local measurements reflect
  // production transport.
  const compressible = /^(text\/|application\/(json|xml))/.test(type) || type === "image/svg+xml";
  const acceptsGzip = /\bgzip\b/.test(request.headers["accept-encoding"] || "");
  if (compressible && acceptsGzip) {
    response.setHeader("Content-Encoding", "gzip");
    response.setHeader("Vary", "Accept-Encoding");
    createReadStream(filePath).pipe(createGzip({ level: 6 })).pipe(response);
  } else {
    createReadStream(filePath).pipe(response);
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Raccoon Restoration preview: http://127.0.0.1:${port}`);
});
