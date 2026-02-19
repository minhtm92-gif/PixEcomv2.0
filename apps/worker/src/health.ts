import http from 'http';

const startTime = Date.now();

/**
 * Lightweight HTTP health server for the worker process.
 * No NestJS overhead — just a raw Node.js HTTP server.
 *
 * GET /health → 200 { status: "ok", queue: "stats-sync", uptime: <seconds> }
 */
export function startHealthServer(port = 3001): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      const body = JSON.stringify({
        status: 'ok',
        queue: 'stats-sync',
        uptime: Math.floor((Date.now() - startTime) / 1000),
      });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(body);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'health-server-started',
        port,
        ts: new Date().toISOString(),
      }),
    );
  });

  return server;
}
