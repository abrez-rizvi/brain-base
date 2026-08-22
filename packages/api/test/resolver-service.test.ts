import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResolverService } from '../src/services/resolver-service.js';
import { githubService } from '../src/services/github-service.js';
import { treeCache } from '../src/services/tree-cache.js';

describe('ResolverService', () => {
  let resolver: ResolverService;

  beforeEach(() => {
    treeCache.clear();
    resolver = new ResolverService();
    vi.restoreAllMocks();
  });

  it('discovers and filters tree items properly', async () => {
    vi.spyOn(githubService, 'getGitTree').mockResolvedValue([
      { path: 'README.md', mode: '100644', type: 'blob', sha: '1', size: 150, url: '' },
      { path: 'knowledge/arch.md', mode: '100644', type: 'blob', sha: '2', size: 300, url: '' },
      { path: 'skills/api/SKILL.md', mode: '100644', type: 'blob', sha: '3', size: 450, url: '' },
      { path: 'images/logo.png', mode: '100644', type: 'blob', sha: '4', size: 2000, url: '' }, // Binary
      { path: '.git/config', mode: '100644', type: 'blob', sha: '5', size: 50, url: '' }, // Git internal
      { path: 'docs', mode: '040000', type: 'tree', sha: '6', url: '' }, // Directory tree
    ]);

    const result = await resolver.getOrDiscoverFiles('acme', 'project', 'main');

    expect(result.repository).toBe('acme/project');
    expect(result.branch).toBe('main');
    expect(result.totalFiles).toBe(3);
    expect(result.files.map((f) => f.path)).toEqual([
      'README.md',
      'knowledge/arch.md',
      'skills/api/SKILL.md',
    ]);
  });

  it('applies prefix filtering correctly', async () => {
    vi.spyOn(githubService, 'getGitTree').mockResolvedValue([
      { path: 'README.md', mode: '100644', type: 'blob', sha: '1', size: 100, url: '' },
      { path: 'knowledge/arch.md', mode: '100644', type: 'blob', sha: '2', size: 200, url: '' },
      { path: 'knowledge/security.md', mode: '100644', type: 'blob', sha: '3', size: 300, url: '' },
      { path: 'skills/api/SKILL.md', mode: '100644', type: 'blob', sha: '4', size: 400, url: '' },
    ]);

    const result = await resolver.getOrDiscoverFiles('acme', 'project', 'main', false, 'knowledge/');

    expect(result.totalFiles).toBe(2);
    expect(result.files.map((f) => f.path)).toEqual([
      'knowledge/arch.md',
      'knowledge/security.md',
    ]);
  });

  it('normalizes case-insensitive file lookups', async () => {
    vi.spyOn(githubService, 'getGitTree').mockResolvedValue([
      { path: 'readme.md', mode: '100644', type: 'blob', sha: '1', size: 100, url: '' },
      { path: 'Knowledge/Architecture.md', mode: '100644', type: 'blob', sha: '2', size: 200, url: '' },
    ]);

    // Request uppercase README.md -> resolves to actual lowercase readme.md
    const resolvedReadme = await resolver.resolveFilePath('acme', 'project', 'main', 'README.md');
    expect(resolvedReadme.exactPath).toBe('readme.md');

    // Request lowercase knowledge/architecture.md -> resolves to actual Knowledge/Architecture.md
    const resolvedArch = await resolver.resolveFilePath('acme', 'project', 'main', 'knowledge/architecture.md');
    expect(resolvedArch.exactPath).toBe('Knowledge/Architecture.md');
  });

  it('uses cache on subsequent calls unless fresh=true', async () => {
    const gitTreeSpy = vi.spyOn(githubService, 'getGitTree').mockResolvedValue([
      { path: 'README.md', mode: '100644', type: 'blob', sha: '1', size: 100, url: '' },
    ]);

    // First call: hits GitHub
    await resolver.getOrDiscoverFiles('acme', 'project', 'main', false);
    expect(gitTreeSpy).toHaveBeenCalledTimes(1);

    // Second call: hits cache
    await resolver.getOrDiscoverFiles('acme', 'project', 'main', false);
    expect(gitTreeSpy).toHaveBeenCalledTimes(1);

    // Third call with fresh=true: bypasses cache and hits GitHub again
    await resolver.getOrDiscoverFiles('acme', 'project', 'main', true);
    expect(gitTreeSpy).toHaveBeenCalledTimes(2);
  });
});
