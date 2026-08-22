import { serve } from '@hono/node-server';
import { app } from './app.js';
import { config } from './config.js';

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`[Ever-Brain MCP] 🚀 Running on http://localhost:${info.port}`);
    console.log(`[Ever-Brain MCP] 🔗 Connected to Ever-Brain API at: ${config.apiUrl}`);
    console.log(`[Ever-Brain MCP] 📡 Streamable HTTP Transport: POST /mcp/:owner/:repo`);
    console.log(`[Ever-Brain MCP] 📡 Legacy SSE Transport: GET /sse/:owner/:repo`);
  }
);

// Graceful shutdown handling
const shutdown = () => {
  console.log('\n[Ever-Brain MCP] 🛑 Shutting down server gracefully...');
  server.close(() => {
    console.log('[Ever-Brain MCP] Server stopped.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app };
