import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { serve, ServerType } from '@hono/node-server';
import { app as apiApp } from '../../api/src/app.js';
import { app as mcpApp } from '../src/app.js';
import { config as mcpConfig } from '../src/config.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../src/server/mcp-server-factory.js';
import { ApiClient } from '../src/client/api-client.js';

describe('Knowiki MCP End-to-End Integration Suite', () => {
  const API_PORT = 3894;
  const MCP_PORT = 3895;

  let apiServerInstance: ServerType;
  let mcpServerInstance: ServerType;

  beforeAll(async () => {
    mcpConfig.apiUrl = `http://localhost:${API_PORT}`;

    apiServerInstance = serve({
      fetch: apiApp.fetch,
      port: API_PORT,
    });

    mcpServerInstance = serve({
      fetch: mcpApp.fetch,
      port: MCP_PORT,
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
  });

  afterAll(async () => {
    apiServerInstance.close();
    mcpServerInstance.close();
  });

  describe('Section 1: MCP Server HTTP Endpoints', () => {
    it('GET /health returns 200 OK and valid health metadata', async () => {
      const res = await fetch(`http://localhost:${MCP_PORT}/health`);
      expect(res.status).toBe(200);

      const json = (await res.json()) as any;
      expect(json.status).toBe('ok');
      expect(json.service).toBe('knowiki-mcp');
      expect(json.apiUrl).toBe(`http://localhost:${API_PORT}`);
    });

    it('GET / exposes Knowiki MCP capabilities and tool manifests', async () => {
      const res = await fetch(`http://localhost:${MCP_PORT}/`);
      expect(res.status).toBe(200);

      const json = (await res.json()) as any;
      expect(json.name).toBe('Knowiki MCP');
      expect(json.capabilities).toEqual(['resources', 'tools']);
      expect(json.tools).toContain('list_files');
      expect(json.tools).toContain('read_file');
      expect(json.tools).toContain('search_files');
    });
  });

  describe('Section 2: Repository Validation & Guardrails', () => {
    it('GET /sse without target repo returns 400 Bad Request', async () => {
      const res = await fetch(`http://localhost:${MCP_PORT}/sse`);
      expect(res.status).toBe(400);

      const json = (await res.json()) as any;
      expect(json.code).toBe('INVALID_REPO_CONTEXT');
    });

    it('POST /mcp without target repo returns 400 Bad Request', async () => {
      const res = await fetch(`http://localhost:${MCP_PORT}/mcp`, { method: 'POST' });
      expect(res.status).toBe(400);

      const json = (await res.json()) as any;
      expect(json.code).toBe('INVALID_REPO_CONTEXT');
    });

    it('returns 404 for nonexistent routes', async () => {
      const res = await fetch(`http://localhost:${MCP_PORT}/unregistered-route`);
      expect(res.status).toBe(404);
    });
  });

  describe('Section 3: Dual MCP Surface (Resources & Tools)', () => {
    let mockClient: ApiClient;
    let mcpClient: Client;

    beforeAll(async () => {
      mockClient = new ApiClient(`http://localhost:${API_PORT}`);

      mockClient.getFiles = async () => ({
        repository: 'knowiki/sample-docs',
        branch: 'main',
        totalFiles: 3,
        files: [
          { path: 'README.md', type: 'file', sizeBytes: 500, mimeType: 'text/markdown' },
          { path: 'knowledge/architecture.md', type: 'file', sizeBytes: 1200, mimeType: 'text/markdown' },
          { path: 'skills/deploy/SKILL.md', type: 'file', sizeBytes: 800, mimeType: 'text/markdown' },
        ],
      });

      mockClient.getFileContent = async (_o, _r, path) => {
        if (path === 'knowledge/architecture.md') {
          return {
            content: '# Architecture Overview\nOur system uses MCP and Hono.',
            mimeType: 'text/markdown',
            exactPath: 'knowledge/architecture.md',
            branch: 'main',
          };
        }
        if (path === 'skills/deploy/SKILL.md') {
          return {
            content: '# Deploy Skill\nRun pnpm build and docker deploy.',
            mimeType: 'text/markdown',
            exactPath: 'skills/deploy/SKILL.md',
            branch: 'main',
          };
        }
        if (path === 'README.md') {
          return {
            content: '# Knowiki Sample Project\nWelcome to our docs.',
            mimeType: 'text/markdown',
            exactPath: 'README.md',
            branch: 'main',
          };
        }
        throw new Error(`File '${path}' not found`);
      };

      mockClient.searchFiles = async (_o, _r, query) => ({
        query,
        totalMatches: 1,
        results: [
          {
            path: 'knowledge/architecture.md',
            matches: 1,
            lines: [2],
          },
        ],
      });

      const server = createMcpServer({ owner: 'knowiki', repo: 'sample-docs' }, mockClient);
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      mcpClient = new Client({ name: 'integration-test-agent', version: '1.0.0' }, { capabilities: {} });
      await Promise.all([
        server.connect(serverTransport),
        mcpClient.connect(clientTransport),
      ]);
    });

    it('exposes resources with knowiki:// scheme', async () => {
      const res = await mcpClient.listResources();
      expect(res.resources).toHaveLength(3);
      expect(res.resources[0].uri).toBe('knowiki://repo/README.md');
      expect(res.resources[1].uri).toBe('knowiki://repo/knowledge/architecture.md');
      expect(res.resources[2].uri).toBe('knowiki://repo/skills/deploy/SKILL.md');
    });

    it('reads markdown resources losslessly', async () => {
      const res = await mcpClient.readResource({ uri: 'knowiki://repo/knowledge/architecture.md' });
      expect(res.contents).toHaveLength(1);
      expect((res.contents[0] as any).text).toContain('# Architecture Overview');
      expect(res.contents[0].mimeType).toBe('text/markdown');
    });

    it('executes list_files tool with filtering', async () => {
      const res = await mcpClient.callTool({
        name: 'list_files',
        arguments: { filter_extension: '.md' },
      });
      expect(res.isError).toBeFalsy();

      const parsed = JSON.parse((res.content[0] as any).text);
      expect(parsed.totalFiles).toBe(3);
      expect(parsed.repository).toBe('knowiki/sample-docs');
    });

    it('executes read_file tool', async () => {
      const res = await mcpClient.callTool({
        name: 'read_file',
        arguments: { path: 'skills/deploy/SKILL.md' },
      });
      expect(res.isError).toBeFalsy();
      expect((res.content[0] as any).text).toContain('# Deploy Skill');
    });

    it('executes search_files tool', async () => {
      const res = await mcpClient.callTool({
        name: 'search_files',
        arguments: { query: 'MCP' },
      });
      expect(res.isError).toBeFalsy();

      const parsed = JSON.parse((res.content[0] as any).text);
      expect(parsed.totalMatches).toBe(1);
      expect(parsed.results[0].path).toBe('knowledge/architecture.md');
    });

    it('handles file not found gracefully in tool call without RPC crash', async () => {
      const res = await mcpClient.callTool({
        name: 'read_file',
        arguments: { path: 'missing.md' },
      });
      expect(res.isError).toBe(true);
      expect((res.content[0] as any).text).toContain("File 'missing.md' not found");
    });
  });

  describe('Section 4: SSE Transport & Message Protocol', () => {
    it('negotiates SSE stream connection and processes JSON-RPC messages', async () => {
      const sseRes = await fetch(`http://localhost:${MCP_PORT}/sse/facebook/react`);
      expect(sseRes.status).toBe(200);
      expect(sseRes.headers.get('content-type')).toContain('text/event-stream');

      const reader = sseRes.body?.getReader();
      expect(reader).toBeDefined();

      if (reader) {
        const { value } = await reader.read();
        const initialChunk = new TextDecoder().decode(value);
        expect(initialChunk).toContain('event: endpoint');
        const endpointMatch = initialChunk.match(/data: (https?:\/\/[^\r\n]+)/);
        const endpointUrl = endpointMatch ? endpointMatch[1] : `http://localhost:${MCP_PORT}/messages?sessionId=${sessionId}`;

        if (endpointUrl) {
          const initRes = await fetch(endpointUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'initialize',
              params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'vitest-sse-tester', version: '1.0.0' },
              },
            }),
          });
          expect([200, 202]).toContain(initRes.status);

          const { value: responseChunk } = await reader.read();
          const responseText = new TextDecoder().decode(responseChunk);
          expect(responseText).toContain('"jsonrpc":"2.0"');
          expect(responseText).toContain('knowiki-mcp');
        }

        await reader.cancel();
      }
    });
  });

  describe('Section 5: Streamable HTTP Transport (MCP 2025-03-26)', () => {
    it('initializes session over POST /mcp/:owner/:repo and returns session ID', async () => {
      const initPayload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'vitest-streamable-tester', version: '1.0.0' },
        },
      };

      const res = await fetch(`http://localhost:${MCP_PORT}/mcp/facebook/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2025-03-26',
        },
        body: JSON.stringify(initPayload),
      });

      expect(res.status).toBe(200);
      const sessionIdHeader = res.headers.get('mcp-session-id') || res.headers.get('Mcp-Session-Id');
      expect(sessionIdHeader).toBeTruthy();

      const bodyText = await res.text();
      expect(bodyText).toContain('knowiki-mcp');
    });
  });
});
