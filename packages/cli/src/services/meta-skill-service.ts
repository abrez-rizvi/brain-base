import fs from 'node:fs';
import path from 'node:path';

export const META_SKILL_CONTENT = `---
name: ever-brain
description: Query, inspect, modify, and publish shared project knowledge, runbooks, and conventions using the Ever-Brain CLI (evb). Use whenever asking about project conventions, architecture, runbooks, or saving shared knowledge.
---

# Ever-Brain Agent Operator Guide

You are operating Ever-Brain in this workspace. Ever-Brain is the project's shared intelligence layer.

## 1. Finding & Reading Knowledge
- Check connected source: \`evb status --json\`
- List knowledge docs: \`evb knowledge list --json\`
- Read knowledge doc: \`evb knowledge show <path>\`
- List skills & runbooks: \`evb skills list --json\`
- Read skill runbook: \`evb skills show <skill-id>\`

## 2. Capturing & Evolving Knowledge
When the user asks to save, update, or create a skill or knowledge doc:
1. Write/edit the file directly in \`.evb/cache/knowledge/<path>.md\` or \`.evb/cache/skills/<skill-id>/SKILL.md\`.
2. Inspect the diff to verify accuracy: \`evb diff --json\`
3. Publish the changes:
   - For maintainers with write access: \`evb push -m "<concise commit message>"\`
   - For contributors / proposals needing team review: \`evb propose --title "<PR title>" -m "<summary>"\`
4. Confirm the resulting commit SHA or Pull Request URL to the user.
`;

export const AGENTS_MD_SECTION = `
# Project Intelligence (Ever-Brain)

This repository uses **Ever-Brain** for shared project knowledge, conventions, and operational runbooks.

- **Local Knowledge Cache**: \`.evb/cache/\`
- **Query CLI**: \`evb status --json\`, \`evb knowledge show <path>\`, \`evb skills list\`
- **Skill Runbooks**: \`.agents/skills/\` (Activate the \`ever-brain\` skill for runbook operations)
- **Modifications**: When asked to update, save, or propose rules/skills, edit the file in \`.evb/cache/\`, inspect \`evb diff\`, and publish via \`evb push -m "..."\` (maintainers) or \`evb propose\` (PR review).
`;

export class MetaSkillService {
  bootstrapMetaSkill(workspaceRoot: string): { installedLocations: string[] } {
    const installedLocations: string[] = [];

    // 1. Universal Agent Standard: .agents/skills/ever-brain/SKILL.md
    const agentsSkillDir = path.join(workspaceRoot, '.agents', 'skills', 'ever-brain');
    fs.mkdirSync(agentsSkillDir, { recursive: true });
    const agentsSkillFile = path.join(agentsSkillDir, 'SKILL.md');
    fs.writeFileSync(agentsSkillFile, META_SKILL_CONTENT, 'utf8');
    installedLocations.push('.agents/skills/ever-brain/SKILL.md');

    // 2. Project Root Context: AGENTS.md
    const agentsMdPath = path.join(workspaceRoot, 'AGENTS.md');
    if (fs.existsSync(agentsMdPath)) {
      const existing = fs.readFileSync(agentsMdPath, 'utf8');
      if (!existing.includes('Project Intelligence (Ever-Brain)')) {
        fs.appendFileSync(agentsMdPath, `\n${AGENTS_MD_SECTION.trim()}\n`, 'utf8');
        installedLocations.push('AGENTS.md (updated)');
      }
    } else {
      fs.writeFileSync(agentsMdPath, AGENTS_MD_SECTION.trim() + '\n', 'utf8');
      installedLocations.push('AGENTS.md');
    }

    return { installedLocations };
  }
}

export const metaSkillService = new MetaSkillService();
