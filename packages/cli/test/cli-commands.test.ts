import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { projectConfigManager } from '../src/config/project-config.js';
import { cacheService, computeSha256 } from '../src/services/cache-service.js';
import { syncService } from '../src/services/sync-service.js';
import { handleStatus } from '../src/commands/status.js';
import { handleDiff } from '../src/commands/diff.js';
import { handleReset } from '../src/commands/reset.js';
import { handleKnowledgeList, handleKnowledgeShow } from '../src/commands/knowledge.js';
import { handleSkillsList, handleSkillsShow } from '../src/commands/skills.js';

describe('CLI Commands & Workflows', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowiki-cmd-test-'));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Initialize clean mock workspace
    projectConfigManager.writeConfig(testDir, {
      version: 1,
      source: {
        repository: 'https://github.com/acme/project-intelligence',
        branch: 'main',
      },
    });

    const fileContent = '# Authentication Architecture\nDetails about JWT.';
    cacheService.writeCachedFile(testDir, 'knowledge/auth.md', fileContent);
    cacheService.writeCachedFile(
      testDir,
      'skills/deploy/SKILL.md',
      '---\nname: deploy\ndescription: Production deployment runbook\n---\n# Deploy Runbook'
    );

    projectConfigManager.writeState(testDir, {
      last_sync: new Date().toISOString(),
      source_revision: 'main',
      cached_files: 2,
      files: {
        'knowledge/auth.md': computeSha256(fileContent),
        'skills/deploy/SKILL.md': computeSha256(
          '---\nname: deploy\ndescription: Production deployment runbook\n---\n# Deploy Runbook'
        ),
      },
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('runs knowiki status in JSON mode', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleStatus({ json: true });

    expect(consoleSpy).toHaveBeenCalled();
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output.repository).toBe('https://github.com/acme/project-intelligence');
    expect(output.isDirty).toBe(false);
    expect(output.cachedFilesCount).toBe(2);
    expect(output.knowledgeCount).toBe(1);
    expect(output.skillsCount).toBe(1);
  });

  it('detects dirty state on status and diff after local edit', async () => {
    cacheService.writeCachedFile(testDir, 'knowledge/auth.md', '# Auth v2 with RS256');

    const statusSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleStatus({ json: true });

    const statusJson = JSON.parse(statusSpy.mock.calls[0][0]);
    expect(statusJson.isDirty).toBe(true);
    expect(statusJson.modifications.modified).toEqual(['knowledge/auth.md']);

    // Check diff
    const diffSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleDiff(undefined, { json: true });

    const diffJson = JSON.parse(diffSpy.mock.calls[0][0]);
    expect(diffJson.isDirty).toBe(true);
    expect(diffJson.diffs).toHaveLength(1);
    expect(diffJson.diffs[0].file).toBe('knowledge/auth.md');
    expect(diffJson.diffs[0].type).toBe('modified');
  });

  it('runs knowiki knowledge list and show', async () => {
    const listSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleKnowledgeList({ json: true });

    const listJson = JSON.parse(listSpy.mock.calls[0][0]);
    expect(listJson.total).toBe(2); // auth.md and deploy/SKILL.md
    expect(listJson.documents.some((d: any) => d.path === 'knowledge/auth.md')).toBe(true);

    const showSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleKnowledgeShow('knowledge/auth.md', { json: true });

    const showJson = JSON.parse(showSpy.mock.calls[0][0]);
    expect(showJson.content).toContain('Authentication Architecture');
  });

  it('runs knowiki skills list and show', async () => {
    const listSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleSkillsList({ json: true });

    const listJson = JSON.parse(listSpy.mock.calls[0][0]);
    expect(listJson.total).toBe(1);
    expect(listJson.skills[0].id).toBe('deploy');
    expect(listJson.skills[0].description).toBe('Production deployment runbook');

    const showSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleSkillsShow('deploy', { json: true });

    const showJson = JSON.parse(showSpy.mock.calls[0][0]);
    expect(showJson.content).toContain('Deploy Runbook');
  });

  it('resets local modifications with knowiki reset', async () => {
    cacheService.writeCachedFile(testDir, 'knowledge/auth.md', '# Dirty modifications');
    expect(cacheService.computeDirtyState(testDir).isDirty).toBe(true);

    // Mock syncService.sync
    vi.spyOn(syncService, 'sync').mockResolvedValue({
      updated: 1,
      unchanged: 1,
      removed: 0,
      total: 2,
    });

    const resetSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handleReset({ yes: true, json: true });

    expect(resetSpy).toHaveBeenCalled();
    const result = JSON.parse(resetSpy.mock.calls[0][0]);
    expect(result.status).toBe('reset_complete');
  });
});
