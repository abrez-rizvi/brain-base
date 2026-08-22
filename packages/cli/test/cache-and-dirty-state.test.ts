import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { cacheService, computeSha256 } from '../src/services/cache-service.js';
import { projectConfigManager } from '../src/config/project-config.js';

describe('CacheService & Dirty State Detection', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowiki-cache-test-'));
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
});
