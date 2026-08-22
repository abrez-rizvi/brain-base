import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleSseConnect, handleSseMessage } from './transports/sse.js';
import { handleStreamableHttp } from './transports/streamable-http.js';
import { config } from './config.js';

export const app = new Hono();

// Enable CORS for all agent connections
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Mcp-Session-Id',
      'mcp-session-id',
      'MCP-Protocol-Version',
      'mcp-protocol-version',
    ],
    exposeHeaders: [
      'Mcp-Session-Id',
      'mcp-session-id',
      'MCP-Protocol-Version',
      'mcp-protocol-version',
    ],
  })
);

// Health check
const startTime = Date.now();
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'knowiki-mcp',
    version: '1.0.0',
    apiUrl: config.apiUrl,
    uptimeSeconds: Math.round((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// --- Legacy SSE Transports (MCP 2024-11-05) ---
app.get('/sse/:owner/:repo', handleSseConnect);
app.get('/sse', handleSseConnect);
app.post('/sse/:owner/:repo/messages', handleSseMessage);
app.post('/sse/messages', handleSseMessage);
app.post('/messages', handleSseMessage);

// --- Streamable HTTP Transports (MCP 2025-03-26) ---
app.all('/mcp/:owner/:repo', handleStreamableHttp);
app.all('/mcp', handleStreamableHttp);

// --- Server Discovery Endpoints (Antigravity & Plugin Probes) ---
app.all('/server/discover', (c) => {
  return c.json({
    status: 'ok',
    name: 'knowiki-mcp',
    version: '1.0.0',
    capabilities: ['resources', 'tools'],
    tools: ['list_files', 'read_file', 'search_files'],
    transports: ['sse', 'streamableHttp'],
  });
});
app.all('/.well-known/mcp', (c) => {
  return c.json({
    name: 'knowiki-mcp',
    version: '1.0.0',
    capabilities: ['resources', 'tools'],
  });
});

// Root route
app.get('/', (c) => {
  return c.json({
    name: 'Knowiki MCP',
    version: '1.0.0',
    description: 'Knowiki Agent Consumption Adapter',
    transports: {
      streamableHttp: 'POST /mcp/:owner/:repo or POST /mcp?repo=:url',
      sse: 'GET /sse/:owner/:repo or GET /sse?repo=:url',
      messages: 'POST /messages?sessionId=:id',
    },
    capabilities: ['resources', 'tools'],
    tools: ['list_files', 'read_file', 'search_files'],
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

// Error Handler
app.onError((err, c) => {
  console.error('[Knowiki MCP Error]', err);
  return c.json(
    {
      error: err.message || 'Internal MCP error',
      code: 'INTERNAL_ERROR',
    },
    500
  );
});
