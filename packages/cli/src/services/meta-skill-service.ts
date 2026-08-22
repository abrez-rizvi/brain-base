import fs from 'node:fs';
import path from 'node:path';

export const META_SKILL_CONTENT = `---
name: knowiki
description: Query, inspect, modify, and publish shared project knowledge, runbooks, and conventions using the Knowiki CLI. Use whenever asking about project conventions, architecture, runbooks, or saving shared knowledge.
---

# Knowiki Agent Operator Guide

You are operating Knowiki in this workspace. Knowiki is the project's shared intelligence layer.

## 1. Finding & Reading Knowledge
- Check connected source: \`knowiki status --json\`
- List knowledge docs: \`knowiki knowledge list --json\`
- Read knowledge doc: \`knowiki knowledge show <path>\`
- List skills & runbooks: \`knowiki skills list --json\`
- Read skill runbook: \`knowiki skills show <skill-id>\`

## 2. Capturing & Evolving Knowledge
When the user asks to save, update, or create a skill or knowledge doc:
1. Write/edit the file directly in \`.knowiki/cache/knowledge/<path>.md\` or \`.knowiki/cache/skills/<skill-id>/SKILL.md\`.
2. Inspect the diff to verify accuracy: \`knowiki diff --json\`
3. Publish the changes:
   - For maintainers with write access: \`knowiki push -m "<concise commit message>"\`
   - For contributors / proposals needing team review: \`knowiki propose --title "<PR title>" -m "<summary>"\`
4. Confirm the resulting commit SHA or Pull Request URL to the user.
`;

export const AGENTS_MD_SECTION = `
# Project Intelligence (Knowiki)

This repository uses **Knowiki** for shared project knowledge, conventions, and operational runbooks.

- **Local Knowledge Cache**: \`.knowiki/cache/\`
- **Query CLI**: \`knowiki status --json\`, \`knowiki knowledge show <path>\`, \`knowiki skills list\`
- **Skill Runbooks**: \`.agents/skills/\` (Activate the \`knowiki\` skill for runbook operations)
- **Modifications**: When asked to update, save, or propose rules/skills, edit the file in \`.knowiki/cache/\`, inspect \`knowiki diff\`, and publish via \`knowiki push -m "..."\` (maintainers) or \`knowiki propose\` (PR review).
`;

export class MetaSkillService {
  bootstrapMetaSkill(workspaceRoot: string): { installedLocations: string[] } {
    const installedLocations: string[] = [];

    // 1. Universal Agent Standard: .agents/skills/knowiki/SKILL.md
    const agentsSkillDir = path.join(workspaceRoot, '.agents', 'skills', 'knowiki');
    fs.mkdirSync(agentsSkillDir, { recursive: true });
    const agentsSkillFile = path.join(agentsSkillDir, 'SKILL.md');
    fs.writeFileSync(agentsSkillFile, META_SKILL_CONTENT, 'utf8');
    installedLocations.push('.agents/skills/knowiki/SKILL.md');

    // 2. Project Root Context: AGENTS.md
    const agentsMdPath = path.join(workspaceRoot, 'AGENTS.md');
    if (fs.existsSync(agentsMdPath)) {
      const existing = fs.readFileSync(agentsMdPath, 'utf8');
      if (!existing.includes('Project Intelligence (Knowiki)')) {
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
