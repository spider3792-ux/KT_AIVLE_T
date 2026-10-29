#!/usr/bin/env node
// Local static server for the quiz site.  Usage: node scripts/serve.mjs [port] [--fake-sheet]   (default 8080, env PORT)
// --fake-sheet: config.json points at /__sheet, where apps-script/Code.gs runs in memory (POST /__sheet/reset empties it).
// Binds to 127.0.0.1 only, never rewrites clean URLs (parity with GitHub Pages), answers 403 outside the repo root.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAppsScript } from './lib/fake-apps-script.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const fakeSheet = args.includes('--fake-sheet');
const port = Number(args.find((a) => /^\d+$/.test(a)) ?? process.env.PORT ?? 8080);
let sheetApp = fakeSheet ? loadAppsScript() : null;

function json(res, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

// The fake web app: same request body and reply as the deployed Apps Script.
function fakeSheetRoute(req, res, pathname) {
  if (pathname === '/config.json') return json(res, { sheetUrl: '__sheet' }), true;
  if (req.method !== 'POST' || !pathname.startsWith('/__sheet')) return false;
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (pathname === '/__sheet/reset') {
      sheetApp = loadAppsScript();
      return json(res, { ok: true });
    }
    json(res, sheetApp.post(body));
  });
  return true;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (fakeSheet && fakeSheetRoute(req, res, pathname)) return;
    let file = resolve(join(root, normalize(pathname)));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('forbidden');
    }
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    const size = statSync(file).size;
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': size,
      'cache-control': 'no-store',
    });
    createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
