// ═══════════════════════════════════════════════════════════════════
//  Serveur Web Sécurisé & Distribution APK — FITIA PRO MINER V3.2
// ═══════════════════════════════════════════════════════════════════
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const HOST = '0.0.0.0';
const ROOT = __dirname;

const ALLOWED_ROOT_FILES = new Set([
  '/index.html',
  '/landing.css',
  '/FITIA-PRO-Miner.apk'
]);

const ALLOWED_DIRS = ['/assets/'];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.apk': 'application/vnd.android.package-archive'
};

function isAllowedRequestPath(pathname) {
  if (pathname.includes('..') || pathname.includes('\0')) return false;
  if (ALLOWED_ROOT_FILES.has(pathname)) return true;
  return ALLOWED_DIRS.some((prefix) => pathname.startsWith(prefix) && !pathname.slice(prefix.length).includes('/..'));
}

const server = http.createServer((req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('405 Method Not Allowed');
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === '/') pathname = '/index.html';

    if (!isAllowedRequestPath(pathname)) {
      res.writeHead(403, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end('403 Forbidden');
      return;
    }

    const filePath = path.resolve(ROOT, '.' + pathname);
    if (!filePath.startsWith(ROOT + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const headers = {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Content-Length': stats.size,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Cache-Control': ext === '.apk' ? 'no-store' : 'no-cache'
      };

      if (ext === '.apk') {
        headers['Content-Disposition'] = `attachment; filename="${path.basename(filePath)}"`;
      }

      res.writeHead(200, headers);
      if (req.method === 'HEAD') {
        res.end();
      } else {
        fs.createReadStream(filePath).pipe(res);
      }
    });
  } catch (_) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500 Internal Server Error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`FITIA PRO MINER secure server listening on http://${HOST}:${PORT}`);
});
