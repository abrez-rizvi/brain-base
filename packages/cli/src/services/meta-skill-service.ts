import fs from 'node:fs';
import path from 'node:path';

export const META_SKILL_CONTENT = `---
name: knowiki-operator
description: Query, inspect, modify, and publish shared project knowledge, runbooks, and conventions using the Knowiki CLI.
whenToUse: Use when the developer asks about project architecture, conventions, workflows, database rules, or asks to save, update, or propose runbooks and skills.
triggers:
  - "what is our convention for"
  - "how do we deploy/migrate/test"
  - "update the runbook"
  - "save this knowledge/skill"
  - "propose a rule change"
  - "knowiki"
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

export const CURSOR_RULE_CONTENT = `---
description: Knowiki project intelligence operator rule
globs: .knowiki/**
---

# Knowiki Project Intelligence Guide

Use the Knowiki CLI to read, inspect, and update shared project intelligence:
- Query status: \`knowiki status --json\`
- View knowledge: \`knowiki knowledge list\` / \`knowiki knowledge show <path>\`
- View skills: \`knowiki skills list\` / \`knowiki skills show <skill-id>\`
- Modify files in \`.knowiki/cache/\`, check \`knowiki diff\`, and publish via \`knowiki push -m "..."\` or \`knowiki propose\`.
`;

export class MetaSkillService {
  bootstrapMetaSkill(workspaceRoot: string): { installedLocations: string[] } {
    const installedLocations: string[] = [];

    // 1. Antigravity / Gemini: .gemini/skills/knowiki/SKILL.md
    const geminiSkillDir = path.join(workspaceRoot, '.gemini', 'skills', 'knowiki');
    fs.mkdirSync(geminiSkillDir, { recursive: true });
    const geminiSkillFile = path.join(geminiSkillDir, 'SKILL.md');
    fs.writeFileSync(geminiSkillFile, META_SKILL_CONTENT, 'utf8');
    installedLocations.push('.gemini/skills/knowiki/SKILL.md');

    // 2. Cursor: .cursor/rules/knowiki.mdc
    const cursorDir = path.join(workspaceRoot, '.cursor', 'rules');
    fs.mkdirSync(cursorDir, { recursive: true });
    const cursorFile = path.join(cursorDir, 'knowiki.mdc');
    fs.writeFileSync(cursorFile, CURSOR_RULE_CONTENT, 'utf8');
    installedLocations.push('.cursor/rules/knowiki.mdc');

    // 3. Claude: .claude/skills/knowiki/SKILL.md
    const claudeDir = path.join(workspaceRoot, '.claude', 'skills', 'knowiki');
    fs.mkdirSync(claudeDir, { recursive: true });
    const claudeFile = path.join(claudeDir, 'SKILL.md');
    fs.writeFileSync(claudeFile, META_SKILL_CONTENT, 'utf8');
    installedLocations.push('.claude/skills/knowiki/SKILL.md');

    return { installedLocations };
  }
}

export const metaSkillService = new MetaSkillService();
