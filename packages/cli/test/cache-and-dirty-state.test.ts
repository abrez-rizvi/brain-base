import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { cacheService, computeSha256 } from '../src/services/cache-service.js';
import { projectConfigManager } from '../src/config/project-config.js';

describe('CacheService & Dirty State Detection', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evb-cache-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('reads, writes, and lists cached files', () => {
    cacheService.writeCachedFile(testDir, 'knowledge/auth.md', '# Auth Guide');
    cacheService.writeCachedFile(testDir, 'skills/deploy/SKILL.md', '# Deploy Runbook');

    const authContent = cacheService.readCachedFile(testDir, 'knowledge/auth.md');
    expect(authContent).toBe('# Auth Guide');

    const files = cacheService.listCachedFiles(testDir);
    expect(files).toEqual(['knowledge/auth.md', 'skills/deploy/SKILL.md']);
  });

  it('correctly identifies clean working tree against state baseline', () => {
    const content1 = '# Guide 1';
    const content2 = '# Guide 2';

    cacheService.writeCachedFile(testDir, 'knowledge/g1.md', content1);
    cacheService.writeCachedFile(testDir, 'knowledge/g2.md', content2);

    projectConfigManager.writeState(testDir, {
      last_sync: new Date().toISOString(),
      source_revision: 'main',
      cached_files: 2,
      files: {
        'knowledge/g1.md': computeSha256(content1),
        'knowledge/g2.md': computeSha256(content2),
      },
    });

    const dirty = cacheService.computeDirtyState(testDir);
    expect(dirty.isDirty).toBe(false);
    expect(dirty.modified).toHaveLength(0);
    expect(dirty.added).toHaveLength(0);
    expect(dirty.deleted).toHaveLength(0);
  });

  it('detects modified, added, and deleted files accurately', () => {
    const original1 = '# Original 1';
    const original2 = '# Original 2';

    // Baseline has g1.md and g2.md
    projectConfigManager.writeState(testDir, {
      last_sync: new Date().toISOString(),
      source_revision: 'main',
      cached_files: 2,
      files: {
        'knowledge/g1.md': computeSha256(original1),
        'knowledge/g2.md': computeSha256(original2),
      },
    });

    // Local changes:
    // 1. g1.md is modified
    cacheService.writeCachedFile(testDir, 'knowledge/g1.md', '# Modified 1 content');
    // 2. g2.md is deleted (do not write it)
    // 3. g3.md is newly added
    cacheService.writeCachedFile(testDir, 'knowledge/g3.md', '# Newly Added 3');

    const dirty = cacheService.computeDirtyState(testDir);
    expect(dirty.isDirty).toBe(true);
    expect(dirty.modified).toEqual(['knowledge/g1.md']);
    expect(dirty.deleted).toEqual(['knowledge/g2.md']);
    expect(dirty.added).toEqual(['knowledge/g3.md']);
  });

  it('correctly caches and synchronizes empty files without errors', async () => {
    projectConfigManager.writeConfig(testDir, {
      version: 1,
      source: {
        repository: 'https://github.com/acme/empty-docs',
        branch: 'main',
      },
    });

    const mockClient = {
      getFiles: async () => ({
        repository: 'acme/empty-docs',
        branch: 'main',
        totalFiles: 2,
        files: [
          { path: 'empty.md', type: 'file', sizeBytes: 0, mimeType: 'text/markdown' },
          { path: 'non-empty.md', type: 'file', sizeBytes: 15, mimeType: 'text/markdown' },
        ],
      }),
      getFileContent: async (_owner: string, _repo: string, filePath: string) => {
        if (filePath === 'empty.md') {
          return { content: '', exactPath: 'empty.md', branch: 'main' };
        }
        return { content: '# Not Empty', exactPath: 'non-empty.md', branch: 'main' };
      },
    };

    const { syncService } = await import('../src/services/sync-service.js');
    const result = await syncService.sync(testDir, {
      client: mockClient as any,
      force: true,
    });

    expect(result.total).toBe(2);
    expect(result.updated).toBe(2);
    expect(cacheService.readCachedFile(testDir, 'empty.md')).toBe('');
    expect(cacheService.readCachedFile(testDir, 'non-empty.md')).toBe('# Not Empty');

    const dirty = cacheService.computeDirtyState(testDir);
    expect(dirty.isDirty).toBe(false);
  });
});
