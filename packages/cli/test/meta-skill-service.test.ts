import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { metaSkillService } from '../src/services/meta-skill-service.js';

describe('MetaSkillService', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evb-meta-test-'));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('bootstraps universal .agents/skills/ever-brain/SKILL.md and project AGENTS.md', () => {
    const result = metaSkillService.bootstrapMetaSkill(testDir);

    expect(result.installedLocations).toContain('.agents/skills/ever-brain/SKILL.md');
    expect(result.installedLocations).toContain('AGENTS.md');

    const agentsSkillPath = path.join(testDir, '.agents', 'skills', 'ever-brain', 'SKILL.md');
    expect(fs.existsSync(agentsSkillPath)).toBe(true);
    const skillContent = fs.readFileSync(agentsSkillPath, 'utf8');
    expect(skillContent).toContain('name: ever-brain');
    expect(skillContent).toContain('evb status');

    const agentsMdPath = path.join(testDir, 'AGENTS.md');
    expect(fs.existsSync(agentsMdPath)).toBe(true);
    const mdContent = fs.readFileSync(agentsMdPath, 'utf8');
    expect(mdContent).toContain('Project Intelligence (Ever-Brain)');
  });
});
