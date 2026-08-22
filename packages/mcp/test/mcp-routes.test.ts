import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';

describe('Knowiki MCP HTTP Routes', () => {
  describe('GET /health', () => {
    it('returns healthy status and version', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(json.service).toBe('knowiki-mcp');
      expect(json.version).toBe('1.0.0');
      expect(typeof json.uptimeSeconds).toBe('number');
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('returns server metadata, capabilities, and tool surface', async () => {
      const res = await app.request('/');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.name).toBe('Knowiki MCP');
      expect(json.capabilities).toEqual(['resources', 'tools']);
      expect(json.tools).toContain('list_files');
      expect(json.tools).toContain('read_file');
      expect(json.tools).toContain('search_files');
    });
  });

  describe('Repository Validation', () => {
    it('returns 400 when connecting to /sse without a target repository', async () => {
      const res = await app.request('/sse');
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe('INVALID_REPO_CONTEXT');
    });

    it('returns 400 when connecting to /mcp without a target repository', async () => {
      const res = await app.request('/mcp', { method: 'POST' });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe('INVALID_REPO_CONTEXT');
    });
  });

  describe('404 Handler', () => {
    it('returns structured 404 for unknown endpoints', async () => {
      const res = await app.request('/unknown-endpoint');
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.code).toBe('NOT_FOUND');
    });
  });
});
