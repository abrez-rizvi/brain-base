import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { materializeService } from '../src/services/materialize-service.js';
import { cacheService } from '../src/services/cache-service.js';

describe('MaterializeService', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowiki-mat-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('materializes skill into Gemini environment', () => {
    cacheService.writeCachedFile(
      testDir,
      'skills/db-migrate/SKILL.md',
      '---\nname: db-migrate\n---\n# DB Migration Runbook'
    );

    const result = materializeService.materialize(testDir, 'db-migrate', { target: 'gemini' });
    expect(result.targetAgent).toBe('gemini');
    expect(result.filesCopied).toBe(1);

    const destFile = path.join(testDir, '.gemini', 'skills', 'db-migrate', 'SKILL.md');
    expect(fs.existsSync(destFile)).toBe(true);
    expect(fs.readFileSync(destFile, 'utf8')).toContain('DB Migration Runbook');
  });

  it('materializes skill into Cursor environment as .mdc rule', () => {
    cacheService.writeCachedFile(
      testDir,
      'skills/testing/SKILL.md',
      '# Testing Guideline'
    );

    const result = materializeService.materialize(testDir, 'testing', { target: 'cursor' });
    expect(result.targetAgent).toBe('cursor');

    const destFile = path.join(testDir, '.cursor', 'rules', 'testing.mdc');
    expect(fs.existsSync(destFile)).toBe(true);
    expect(fs.readFileSync(destFile, 'utf8')).toContain('Testing Guideline');
  });
});
