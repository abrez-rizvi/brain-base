import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthRouter } from './routes/health.js';
import { reposRouter } from './routes/repos.js';

export const app = new Hono();

// Enable CORS for all incoming agent/developer requests
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'HEAD', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['X-Knowiki-Path', 'X-Knowiki-Branch'],
  })
);

// Route mounts
app.route('/health', healthRouter);
app.route('/repos', reposRouter);

// Backward compatibility mount: /projects/:owner/:repo -> /repos/:owner/:repo
app.route('/projects', reposRouter);

// Root route
app.get('/', (c) => {
  return c.json({
    name: 'Knowiki API',
    version: '1.0.0',
    description: 'Knowiki Stateless Content Access Layer',
    endpoints: [
      'GET /health',
      'GET /repos/:owner/:repo',
      'GET /repos/:owner/:repo/files',
      'GET /repos/:owner/:repo/file/*path',
      'GET /repos/:owner/:repo/search?q=:query',
    ],
  });
});

// 404 Handler
app.notFound((c) => {
  return c.json(
    {
      error: `Route not found: ${c.req.method} ${c.req.path}`,
      code: 'NOT_FOUND',
    },
    404
  );
});

// Global Error Handler
app.onError((err, c) => {
  console.error('[Knowiki API Unhandled Error]', err);
  return c.json(
    {
      error: err.message || 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    },
    500
  );
});
