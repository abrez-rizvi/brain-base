import { serve } from '@hono/node-server';
import { app } from './app.js';
import { config } from './config.js';

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`[Knowiki MCP] 🚀 Running on http://localhost:${info.port}`);
    console.log(`[Knowiki MCP] 🔗 Connected to Knowiki API at: ${config.apiUrl}`);
    console.log(`[Knowiki MCP] 📡 Streamable HTTP Transport: POST /mcp/:owner/:repo`);
    console.log(`[Knowiki MCP] 📡 Legacy SSE Transport: GET /sse/:owner/:repo`);
  }
);

// Graceful shutdown handling
const shutdown = () => {
  console.log('\n[Knowiki MCP] 🛑 Shutting down server gracefully...');
  server.close(() => {
    console.log('[Knowiki MCP] Server stopped.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app };
