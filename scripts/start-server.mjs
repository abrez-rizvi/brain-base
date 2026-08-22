import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const API_PORT = process.env.API_PORT || '3894';
const MCP_PORT = process.env.PORT || process.env.MCP_PORT || '7860';

console.log('====================================================');
console.log('🧠 Ever-Brain Unified Gateway Server');
console.log(`📡 Public MCP Port: ${MCP_PORT}`);
console.log(`⚙️  Internal API Port: ${API_PORT}`);
console.log('====================================================');

// 1. Start Internal API Engine
const apiProcess = fork(path.join(rootDir, 'packages/api/dist/index.js'), [], {
  env: {
    ...process.env,
    PORT: API_PORT,
    API_PORT: API_PORT,
  },
  stdio: 'inherit',
});

// Wait briefly for API engine to initialize
await new Promise((resolve) => setTimeout(resolve, 800));

// 2. Start Live MCP Server
const mcpProcess = fork(path.join(rootDir, 'packages/mcp/dist/index.js'), [], {
  env: {
    ...process.env,
    PORT: MCP_PORT,
    MCP_PORT: MCP_PORT,
    EVB_API_URL: `http://localhost:${API_PORT}`,
    API_URL: `http://localhost:${API_PORT}`,
  },
  stdio: 'inherit',
});

const cleanup = () => {
  apiProcess.kill();
  mcpProcess.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
