import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { app as electronApp } from 'electron';

let server: Server | null = null;
let serverPort: number | null = null;

// MIME type mapping
const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Serve a file from the app directory
 */
async function serveFile(filePath: string, res: ServerResponse): Promise<void> {
  try {
    const content = await readFile(filePath);
    const ext = extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

/**
 * Start a local HTTP server to serve the app
 * This fixes YouTube embedding issues by using localhost instead of custom protocols
 */
export async function startLocalServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const staticPath = join(electronApp.getAppPath(), 'app');

    server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        });
        res.end();
        return;
      }

      let requestPath = req.url || '/';
      
      // Remove query string
      const queryIndex = requestPath.indexOf('?');
      if (queryIndex !== -1) {
        requestPath = requestPath.substring(0, queryIndex);
      }

      // Default to index.html for root or paths without extension (SPA routing)
      if (requestPath === '/' || !extname(requestPath)) {
        requestPath = '/index.html';
      }

      const filePath = join(staticPath, requestPath);

      // Security check: ensure the file is within staticPath
      if (!filePath.startsWith(staticPath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      // Check if file exists
      try {
        const stats = await stat(filePath);
        if (stats.isFile()) {
          await serveFile(filePath, res);
        } else {
          // If it's a directory or doesn't exist, serve index.html for SPA
          await serveFile(join(staticPath, 'index.html'), res);
        }
      } catch {
        // File doesn't exist, serve index.html for SPA routing
        await serveFile(join(staticPath, 'index.html'), res);
      }
    });

    // Try to find an available port starting from 48000
    const tryPort = (port: number) => {
      server!
        .listen(port, 'localhost')
        .on('listening', () => {
          serverPort = port;
          console.log(`Local server started on http://localhost:${port}`);
          resolve(`http://localhost:${port}`);
        })
        .on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is in use, trying ${port + 1}`);
            tryPort(port + 1);
          } else {
            reject(err);
          }
        });
    };

    tryPort(48000);
  });
}

/**
 * Stop the local HTTP server
 */
export function stopLocalServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('Local server stopped');
        server = null;
        serverPort = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Get the current server URL
 */
export function getServerUrl(): string | null {
  return serverPort ? `http://localhost:${serverPort}` : null;
}

