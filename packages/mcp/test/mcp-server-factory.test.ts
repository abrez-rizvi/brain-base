import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createMcpServer } from '../src/server/mcp-server-factory.js';
import { ApiClient, ApiClientError } from '../src/client/api-client.js';

describe('MCP Server Factory & Dual Surface', () => {
  let mockApiClient: ApiClient;
  let client: Client;

  beforeEach(async () => {
    mockApiClient = new ApiClient();

    // Mock API responses
    vi.spyOn(mockApiClient, 'getFiles').mockResolvedValue({
      repository: 'acme/project',
      branch: 'main',
      totalFiles: 2,
      files: [
        { path: 'README.md', type: 'file', sizeBytes: 150, mimeType: 'text/markdown' },
        { path: 'knowledge/arch.md', type: 'file', sizeBytes: 300, mimeType: 'text/markdown' },
      ],
    });

    vi.spyOn(mockApiClient, 'getFileContent').mockImplementation(
      async (_owner, _repo, path) => {
        if (path === 'README.md') {
          return {
            content: '# Acme Project\nDocumentation',
            mimeType: 'text/markdown',
            exactPath: 'README.md',
            branch: 'main',
          };
        }
        if (path === 'knowledge/arch.md') {
          return {
            content: '# Architecture\nOur system uses microservices.',
            mimeType: 'text/markdown',
            exactPath: 'knowledge/arch.md',
            branch: 'main',
          };
        }
        throw new ApiClientError(`File '${path}' not found`, 404, 'FILE_NOT_FOUND');
      }
    );

    vi.spyOn(mockApiClient, 'searchFiles').mockResolvedValue({
      query: 'microservices',
      totalMatches: 1,
      results: [
        {
          path: 'knowledge/arch.md',
          matches: 1,
          lines: [2],
        },
      ],
    });

    // Create client and server connected via InMemoryTransport
    const server = createMcpServer({ owner: 'acme', repo: 'project' }, mockApiClient);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client(
      { name: 'test-agent', version: '1.0.0' },
      { capabilities: {} }
    );

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  describe('Capabilities', () => {
    it('declares dual capabilities for resources and tools', () => {
      const capabilities = client.getServerCapabilities();
      expect(capabilities).toBeDefined();
      expect(capabilities?.resources).toBeDefined();
      expect(capabilities?.tools).toBeDefined();
    });
  });

  describe('Resources Surface', () => {
    it('lists repository resources via resources/list', async () => {
      const res = await client.listResources();
      expect(res.resources).toHaveLength(2);
      expect(res.resources[0].uri).toBe('knowiki://repo/README.md');
      expect(res.resources[0].mimeType).toBe('text/markdown');
      expect(res.resources[1].uri).toBe('knowiki://repo/knowledge/arch.md');
    });

    it('reads a resource via resources/read', async () => {
      const res = await client.readResource({ uri: 'knowiki://repo/README.md' });
      expect(res.contents).toHaveLength(1);
      expect((res.contents[0] as any).text).toBe('# Acme Project\nDocumentation');
      expect(res.contents[0].mimeType).toBe('text/markdown');
    });
  });

  describe('Tools Surface', () => {
    it('lists required tools (list_files, read_file, search_files)', async () => {
      const res = await client.listTools();
      const toolNames = res.tools.map((t) => t.name);
      expect(toolNames).toContain('list_files');
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('search_files');
    });

    it('calls list_files tool', async () => {
      const res = await client.callTool({
        name: 'list_files',
        arguments: {},
      });

      expect(res.isError).toBeFalsy();
      const text = (res.content[0] as any).text;
      const parsed = JSON.parse(text);
      expect(parsed.repository).toBe('acme/project');
      expect(parsed.totalFiles).toBe(2);
    });

    it('calls read_file tool with existing file', async () => {
      const res = await client.callTool({
        name: 'read_file',
        arguments: { path: 'README.md' },
      });

      expect(res.isError).toBeFalsy();
      expect((res.content[0] as any).text).toBe('# Acme Project\nDocumentation');
    });

    it('returns safe error content on read_file failure without RPC crash', async () => {
      const res = await client.callTool({
        name: 'read_file',
        arguments: { path: 'nonexistent.md' },
      });

      expect(res.isError).toBe(true);
      expect((res.content[0] as any).text).toContain("File 'nonexistent.md' not found");
    });

    it('calls search_files tool', async () => {
      const res = await client.callTool({
        name: 'search_files',
        arguments: { query: 'microservices' },
      });

      expect(res.isError).toBeFalsy();
      const text = (res.content[0] as any).text;
      const parsed = JSON.parse(text);
      expect(parsed.query).toBe('microservices');
      expect(parsed.totalMatches).toBe(1);
      expect(parsed.results[0].path).toBe('knowledge/arch.md');
    });
  });
});
