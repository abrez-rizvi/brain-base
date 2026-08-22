import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { metaSkillService } from '../src/services/meta-skill-service.js';

describe('MetaSkillService', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowiki-meta-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('bootstraps meta-skill files across Gemini, Cursor, and Claude target paths', () => {
    const result = metaSkillService.bootstrapMetaSkill(testDir);

    expect(result.installedLocations).toContain('.gemini/skills/knowiki/SKILL.md');
    expect(result.installedLocations).toContain('.cursor/rules/knowiki.mdc');
    expect(result.installedLocations).toContain('.claude/skills/knowiki/SKILL.md');

    const geminiSkillPath = path.join(testDir, '.gemini', 'skills', 'knowiki', 'SKILL.md');
    expect(fs.existsSync(geminiSkillPath)).toBe(true);
    const content = fs.readFileSync(geminiSkillPath, 'utf8');
    expect(content).toContain('name: knowiki-operator');
    expect(content).toContain('knowiki status');
  });
});
