import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { projectConfigManager } from '../src/config/project-config.js';

describe('ProjectConfigManager', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowiki-cfg-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('writes and reads config.yaml accurately', () => {
    projectConfigManager.writeConfig(testDir, {
      version: 1,
      source: {
        repository: 'https://github.com/acme/project-intelligence',
        branch: 'main',
      },
    });

    const config = projectConfigManager.readConfig(testDir);
    expect(config.version).toBe(1);
    expect(config.source.repository).toBe('https://github.com/acme/project-intelligence');
    expect(config.source.branch).toBe('main');
  });

  it('writes and reads state.yaml accurately', () => {
    const now = new Date().toISOString();
    projectConfigManager.writeState(testDir, {
      last_sync: now,
      source_revision: 'a83d91f',
      cached_files: 2,
      files: {
        'knowledge/arch.md': 'hash1',
        'skills/test/SKILL.md': 'hash2',
      },
    });

    const state = projectConfigManager.readState(testDir);
    expect(state).not.toBeNull();
    expect(state?.source_revision).toBe('a83d91f');
    expect(state?.cached_files).toBe(2);
    expect(state?.files['knowledge/arch.md']).toBe('hash1');
  });

  it('patches .gitignore without duplicating existing entries', () => {
    projectConfigManager.ensureGitignore(testDir);

    const gitignoreContent = fs.readFileSync(path.join(testDir, '.gitignore'), 'utf8');
    expect(gitignoreContent).toContain('.knowiki/cache/');
    expect(gitignoreContent).toContain('.knowiki/state.yaml');

    // Run again to test idempotency
    projectConfigManager.ensureGitignore(testDir);
    const gitignoreContent2 = fs.readFileSync(path.join(testDir, '.gitignore'), 'utf8');
    const matches = gitignoreContent2.match(/\.knowiki\/cache\//g);
    expect(matches?.length).toBe(1);
  });

  it('finds knowiki root across nested subdirectories', () => {
    projectConfigManager.writeConfig(testDir, {
      version: 1,
      source: { repository: 'https://github.com/acme/repo', branch: 'main' },
    });

    const nestedSubdir = path.join(testDir, 'src', 'deep', 'folder');
    fs.mkdirSync(nestedSubdir, { recursive: true });

    const foundRoot = projectConfigManager.findKnowikiRoot(nestedSubdir);
    expect(foundRoot).toBe(testDir);
  });
});
