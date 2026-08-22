import { describe, it, expect, beforeEach } from 'vitest';
import { TreeCache } from '../src/services/tree-cache.js';
import { FileInfo } from '../src/types/contract.js';

describe('TreeCache Service', () => {
  let cache: TreeCache;

  const sampleFiles: FileInfo[] = [
    { path: 'README.md', type: 'file', sizeBytes: 100, mimeType: 'text/markdown' },
    { path: 'knowledge/arch.md', type: 'file', sizeBytes: 200, mimeType: 'text/markdown' },
  ];

  const samplePathMap = new Map<string, string>([
    ['readme.md', 'README.md'],
    ['knowledge/arch.md', 'knowledge/arch.md'],
  ]);

  beforeEach(() => {
    cache = new TreeCache();
  });

  it('stores and retrieves cache entries within TTL', () => {
    cache.set('acme', 'project', 'main', sampleFiles, samplePathMap, 1000);
    const entry = cache.get('acme', 'project', 'main');

    expect(entry).toBeDefined();
    expect(entry?.files.length).toBe(2);
    expect(entry?.pathMap.get('readme.md')).toBe('README.md');
  });

  it('is case-insensitive for owner, repo, and branch keys', () => {
    cache.set('Acme', 'Project', 'Main', sampleFiles, samplePathMap, 1000);
    const entry = cache.get('acme', 'project', 'main');

    expect(entry).toBeDefined();
    expect(entry?.files.length).toBe(2);
  });

  it('expires entries past TTL', async () => {
    cache.set('acme', 'project', 'main', sampleFiles, samplePathMap, 20); // 20ms TTL
    await new Promise((resolve) => setTimeout(resolve, 35));

    const entry = cache.get('acme', 'project', 'main');
    expect(entry).toBeUndefined();
  });

  it('invalidates entries explicitly', () => {
    cache.set('acme', 'project', 'main', sampleFiles, samplePathMap, 1000);
    expect(cache.get('acme', 'project', 'main')).toBeDefined();

    cache.invalidate('acme', 'project', 'main');
    expect(cache.get('acme', 'project', 'main')).toBeUndefined();
  });
});
