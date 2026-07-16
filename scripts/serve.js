#!/usr/bin/env node
/**
 * scripts/serve.js — tiny static file server for the docs/ folder.
 * No dependencies; Node 18+.
 *
 * Usage: node scripts/serve.js [port]
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..', 'docs');
const port = Number(process.argv[2] || process.env.PORT || 8765);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
    // Prevent path traversal
    const filePath = resolve(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    let s;
    try { s = await stat(filePath); } catch { res.writeHead(404); res.end('Not found'); return; }
    if (s.isDirectory()) {
      const idx = join(filePath, 'index.html');
      try {
        const data = await readFile(idx);
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(data);
        return;
      } catch { res.writeHead(403); res.end('No index'); return; }
    }
    const ext = extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500);
    res.end('Server error: ' + err.message);
  }
});

server.listen(port, () => {
  console.log(`serving ${ROOT} on http://localhost:${port}/`);
});
