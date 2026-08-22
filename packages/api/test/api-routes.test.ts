import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../src/app.js';
import { githubService } from '../src/services/github-service.js';
import { treeCache } from '../src/services/tree-cache.js';

describe('Ever-Brain API Routes', () => {
  beforeEach(() => {
    treeCache.clear();
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('returns healthy operational status', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(json.version).toBe('1.0.0');
      expect(typeof json.uptimeSeconds).toBe('number');
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('GET /repos/:owner/:repo', () => {
    it('returns repository metadata and default branch', async () => {
      vi.spyOn(githubService, 'getRepoMetadata').mockResolvedValue({
        owner: 'acme',
        repo: 'project',
        defaultBranch: 'main',
        description: 'Test repository',
      });

      const res = await app.request('/repos/acme/project');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.owner).toBe('acme');
      expect(json.repo).toBe('project');
      expect(json.defaultBranch).toBe('main');
      expect(json.description).toBe('Test repository');
    });
  });

  describe('GET /repos/:owner/:repo/files', () => {
    it('returns discovered project files', async () => {
      vi.spyOn(githubService, 'getRepoMetadata').mockResolvedValue({
        owner: 'acme',
        repo: 'project',
        defaultBranch: 'main',
      });

      vi.spyOn(githubService, 'getGitTree').mockResolvedValue([
        { path: 'README.md', mode: '100644', type: 'blob', sha: '1', size: 100, url: '' },
        { path: 'knowledge/arch.md', mode: '100644', type: 'blob', sha: '2', size: 200, url: '' },
      ]);

      const res = await app.request('/repos/acme/project/files');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.repository).toBe('acme/project');
      expect(json.branch).toBe('main');
      expect(json.totalFiles).toBe(2);
      expect(json.files[0].path).toBe('README.md');
      expect(json.files[0].mimeType).toBe('text/markdown');
    });

    it('supports /projects alias for backward compatibility', async () => {
      vi.spyOn(githubService, 'getRepoMetadata').mockResolvedValue({
        owner: 'acme',
        repo: 'project',
        defaultBranch: 'main',
      });

      vi.spyOn(githubService, 'getGitTree').mockResolvedValue([
        { path: 'README.md', mode: '100644', type: 'blob', sha: '1', size: 100, url: '' },
      ]);

      const res = await app.request('/projects/acme/project/files');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.repository).toBe('acme/project');
      expect(json.totalFiles).toBe(1);
    });
  });

  describe('GET /repos/:owner/:repo/file/*', () => {
    it('streams raw file content with appropriate MIME and headers', async () => {
      vi.spyOn(githubService, 'getRepoMetadata').mockResolvedValue({
        owner: 'acme',
        repo: 'project',
        defaultBranch: 'main',
      });

      vi.spyOn(githubService, 'getGitTree').mockResolvedValue([
        { path: 'README.md', mode: '100644', type: 'blob', sha: '1', size: 100, url: '' },
      ]);

      vi.spyOn(githubService, 'getRawFileContent').mockResolvedValue({
        status: 200,
        content: '# Test Project\nHello World',
        sizeBytes: 26,
        durationMs: 15,
      });

      const res = await app.request('/repos/acme/project/file/README.md');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/markdown');
      expect(res.headers.get('X-Ever-Brain-Path')).toBe('README.md');
      expect(res.headers.get('X-Ever-Brain-Branch')).toBe('main');

      const text = await res.text();
      expect(text).toBe('# Test Project\nHello World');
    });

    it('returns 404 when file does not exist', async () => {
      vi.spyOn(githubService, 'getRepoMetadata').mockResolvedValue({
        owner: 'acme',
        repo: 'project',
        defaultBranch: 'main',
      });

      vi.spyOn(githubService, 'getGitTree').mockResolvedValue([
        { path: 'README.md', mode: '100644', type: 'blob', sha: '1', size: 100, url: '' },
      ]);

      vi.spyOn(githubService, 'getRawFileContent').mockResolvedValue({
        status: 404,
        sizeBytes: 0,
        durationMs: 10,
      });

      const res = await app.request('/repos/acme/project/file/missing.md');
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.code).toBe('FILE_NOT_FOUND');
    });

    it('returns 200 OK and empty text when file is empty', async () => {
      vi.spyOn(githubService, 'getRepoMetadata').mockResolvedValue({
        owner: 'acme',
        repo: 'project',
        defaultBranch: 'main',
      });

      vi.spyOn(githubService, 'getGitTree').mockResolvedValue([
        { path: 'empty.txt', mode: '100644', type: 'blob', sha: 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391', size: 0, url: '' },
      ]);

      vi.spyOn(githubService, 'getRawFileContent').mockResolvedValue({
        status: 200,
        content: '',
        sizeBytes: 0,
        durationMs: 5,
      });

      const res = await app.request('/repos/acme/project/file/empty.txt');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/plain');
      expect(res.headers.get('X-Ever-Brain-Path')).toBe('empty.txt');

      const text = await res.text();
      expect(text).toBe('');
    });
  });

  describe('GET /repos/:owner/:repo/search', () => {
    it('returns search results matching query string', async () => {
      vi.spyOn(githubService, 'getRepoMetadata').mockResolvedValue({
        owner: 'acme',
        repo: 'project',
        defaultBranch: 'main',
      });

      vi.spyOn(githubService, 'getGitTree').mockResolvedValue([
        { path: 'README.md', mode: '100644', type: 'blob', sha: '1', size: 100, url: '' },
        { path: 'knowledge/auth.md', mode: '100644', type: 'blob', sha: '2', size: 200, url: '' },
      ]);

      vi.spyOn(githubService, 'getRawFileContent').mockImplementation(
        async (_owner, _repo, _branch, filePath) => {
          if (filePath === 'knowledge/auth.md') {
            return {
              status: 200,
              content: '# Authentication\nWe use JWT authentication tokens here.',
              sizeBytes: 55,
              durationMs: 10,
            };
          }
          return {
            status: 200,
            content: '# Project\nGeneral info.',
            sizeBytes: 25,
            durationMs: 10,
          };
        }
      );

      const res = await app.request('/repos/acme/project/search?q=authentication');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.query).toBe('authentication');
      expect(json.totalMatches).toBe(2);
      expect(json.results.length).toBe(1);
      expect(json.results[0].path).toBe('knowledge/auth.md');
      expect(json.results[0].matches).toBe(2);
      expect(json.results[0].lines).toEqual([1, 2]);
    });
  });

  describe('404 Not Found Handler', () => {
    it('returns structured 404 for unknown endpoints', async () => {
      const res = await app.request('/unknown-endpoint');
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.code).toBe('NOT_FOUND');
    });
  });
});
