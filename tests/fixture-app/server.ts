import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';

export interface FixtureServer {
  server: Server;
  port: number;
  url: string;
  close: () => Promise<void>;
}

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function html(res: ServerResponse, statusCode: number, body: string): void {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

function json(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  // GET /
  if (method === 'GET' && url === '/') {
    html(
      res,
      200,
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>f4tl Test App</title></head>
<body>
  <h1>f4tl Test App</h1>
  <nav>
    <ul>
      <li><a href="/form">Form</a></li>
      <li><a href="/error">Error Page</a></li>
      <li><a href="/slow">Slow Page</a></li>
      <li><a href="/api/data">API Data</a></li>
    </ul>
  </nav>
</body>
</html>`,
    );
    return;
  }

  // GET /form
  if (method === 'GET' && url === '/form') {
    html(
      res,
      200,
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Form Page</title></head>
<body>
  <h1>Test Form</h1>
  <form method="POST" action="/form">
    <div>
      <label for="name">Name</label>
      <input type="text" id="name" name="name" />
    </div>
    <div>
      <label for="email">Email</label>
      <input type="email" id="email" name="email" />
    </div>
    <button type="submit">Submit</button>
  </form>
</body>
</html>`,
    );
    return;
  }

  // POST /form
  if (method === 'POST' && url === '/form') {
    const body = await parseBody(req);
    const params = new URLSearchParams(body);
    const name = params.get('name') ?? '';
    const email = params.get('email') ?? '';

    if (!name.trim()) {
      html(
        res,
        400,
        `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Validation Error</title></head>
<body>
  <h1>Validation Error</h1>
  <p class="error">Name is required</p>
  <a href="/form">Back to form</a>
</body>
</html>`,
      );
      return;
    }

    html(
      res,
      200,
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Form Success</title></head>
<body>
  <h1>Success</h1>
  <p>Thank you, ${name}! We will contact you at ${email}.</p>
  <a href="/">Back to home</a>
</body>
</html>`,
    );
    return;
  }

  // GET /error
  if (method === 'GET' && url === '/error') {
    html(
      res,
      200,
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Error Page</title></head>
<body>
  <h1>Error Page</h1>
  <p>This page triggers a console error.</p>
  <script>console.error('Test error')</script>
</body>
</html>`,
    );
    return;
  }

  // GET /slow
  if (method === 'GET' && url === '/slow') {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    html(
      res,
      200,
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Slow Page</title></head>
<body>
  <h1>Slow Page</h1>
  <p>This page took 2 seconds to load.</p>
</body>
</html>`,
    );
    return;
  }

  // GET /api/data
  if (method === 'GET' && url === '/api/data') {
    json(res, 200, { status: 'ok', items: [{ id: 1, name: 'test' }] });
    return;
  }

  // 404
  html(
    res,
    404,
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Not Found</title></head>
<body>
  <h1>404 Not Found</h1>
  <p>The page ${url} does not exist.</p>
  <a href="/">Back to home</a>
</body>
</html>`,
  );
}

export async function startServer(): Promise<FixtureServer> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      handleRequest(req, res).catch((err) => {
        console.error('[fixture-app] Request handler error:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      });
    });

    server.on('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Unexpected server address format'));
        return;
      }
      const port = addr.port;
      const url = `http://127.0.0.1:${port}`;

      resolve({
        server,
        port,
        url,
        close: () =>
          new Promise<void>((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
  });
}
