import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, statSync, watch } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const portFlag = process.argv.indexOf('--port');
const PORT = process.env.PORT || (portFlag >= 0 ? process.argv[portFlag + 1] : 3000);
const LIVE_RELOAD = process.env.NODE_ENV !== 'production' && !process.argv.includes('--no-reload');

const RELOAD_SNIPPET = `  <script>
    (() => {
      const source = new EventSource('/__livereload');
      source.onmessage = () => location.reload();
    })();
  </script>
`;

function sendHtml(req, res, filePath) {
  const html = readFileSync(filePath, 'utf8');
  const body = LIVE_RELOAD ? html.replace('</body>', `${RELOAD_SNIPPET}</body>`) : html;
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'no-store');
  res.send(body);
}

if (LIVE_RELOAD) {
  const clients = new Set();

  app.get('/__livereload', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders();
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
  });

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const urlPath = req.path === '/' ? '/index.html' : req.path;
    if (!urlPath.endsWith('.html')) return next();
    const filePath = join(__dirname, urlPath.replace(/^\/+/, ''));
    try {
      if (!statSync(filePath).isFile()) return next();
    } catch {
      return next();
    }
    sendHtml(req, res, filePath);
  });

  let timer = null;
  const notify = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const res of clients) res.write('data: reload\n\n');
      if (clients.size) console.log(`Live reload sent to ${clients.size} client(s)`);
    }, 120);
  };

  for (const entry of ['index.html', 'js', 'css', 'assets']) {
    try {
      watch(join(__dirname, entry), { recursive: true }, notify);
    } catch {
      
    }
  }

  console.log('Live reload enabled. Save a file and the page refreshes.');
}

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Dev server listening on port ${PORT}`);
});
