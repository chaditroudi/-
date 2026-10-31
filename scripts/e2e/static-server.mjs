/**
 * Serves a built bundle the way production does: static files on one origin, with the API
 * on another. There is no proxy, so `vite preview` behaviour cannot hide or cause a failure.
 *
 *   node scripts/e2e/static-server.mjs <dir> <port>
 */
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const [dir, port] = process.argv.slice(2);
if (!dir || !port) throw new Error("Usage: node scripts/e2e/static-server.mjs <dir> <port>");

const TYPES = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

const root = path.resolve(dir);

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://local").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.resolve(root, relative);
  const isFile = file.startsWith(root) && statSync(file, { throwIfNoEntry: false })?.isFile();
  if (!isFile) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(Number(port), "127.0.0.1", () => console.log(`Serving ${root} on 127.0.0.1:${port}`));
