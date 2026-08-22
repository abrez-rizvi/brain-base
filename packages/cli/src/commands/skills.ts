import pc from 'picocolors';
import YAML from 'yaml';
import prompts from 'prompts';
import { projectConfigManager } from '../config/project-config.js';
import { cacheService } from '../services/cache-service.js';
import { materializeService } from '../services/materialize-service.js';
import { logger } from '../utils/logger.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  entryPath: string;
}

export function parseSkillFrontmatter(content: string, defaultId: string): { name: string; description: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (match && match[1]) {
    try {
      const parsed = YAML.parse(match[1]) as { name?: string; description?: string };
      return {
        name: parsed.name || defaultId,
        description: parsed.description || 'No description provided.',
      };
    } catch {}
  }
  return {
    name: defaultId,
    description: 'No description provided.',
  };
}

export async function handleSkillsList(options: OutputOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findEvbRoot();
  if (!workspaceRoot) {
    return outputError('Not inside an Ever-Brain project. Run `evb init <repo>` first.', 'NOT_IN_WORKSPACE', options);
  }

  try {
    const allFiles = cacheService.listCachedFiles(workspaceRoot);
    const skillFiles = allFiles.filter(
      (f) => f.startsWith('skills/') && (f.endsWith('/SKILL.md') || f.endsWith('.md'))
    );

    const skillsMap = new Map<string, SkillSummary>();

    for (const file of skillFiles) {
      // Determine skill ID
      let skillId = '';
      if (file.endsWith('/SKILL.md')) {
        skillId = file.replace(/^skills\//, '').replace(/\/SKILL\.md$/, '');
      } else {
        skillId = file.replace(/^skills\//, '').replace(/\.md$/, '');
      }

      if (!skillsMap.has(skillId)) {
        const content = cacheService.readCachedFile(workspaceRoot, file) || '';
        const { name, description } = parseSkillFrontmatter(content, skillId);
        skillsMap.set(skillId, {
          id: skillId,
          name,
          description,
          entryPath: file,
        });
      }
    }

    const skillsList = Array.from(skillsMap.values());

    outputResult({ skills: skillsList, total: skillsList.length }, options, () => {
      if (skillsList.length === 0) {
        console.log(pc.yellow('No skills found in cache. Run `evb sync` to update.'));
        return;
      }

      console.log(pc.bold(pc.cyan(`\nAvailable Skills (${skillsList.length}):`)));
      for (const s of skillsList) {
        console.log(`  • ${pc.bold(pc.white(s.id))} — ${pc.dim(s.description)}`);
      }
      console.log(pc.dim(`\nTip: Use 'evb skills show <id>' or 'evb skills install <id>' to materialize.`));
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'SKILLS_ERROR', options);
  }
}

export async function handleSkillsShow(skillId: string, options: OutputOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findEvbRoot();
  if (!workspaceRoot) {
    return outputError('Not inside an Ever-Brain project. Run `evb init <repo>` first.', 'NOT_IN_WORKSPACE', options);
  }

  try {
    let content = cacheService.readCachedFile(workspaceRoot, `skills/${skillId}/SKILL.md`);
    if (content === null) {
      content = cacheService.readCachedFile(workspaceRoot, `skills/${skillId}.md`);
    }

    if (content === null) {
      return outputError(`Skill '${skillId}' not found in cache. Run 'evb sync' to update.`, 'SKILL_NOT_FOUND', options);
    }

    outputResult({ skillId, content }, options, () => {
      console.log(content);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'SKILLS_SHOW_ERROR', options);
  }
}

export interface SkillInstallOptions extends OutputOptions {
  target?: 'agents' | 'gemini' | 'cursor' | 'claude' | 'auto';
  global?: boolean;
  yes?: boolean;
}

export async function handleSkillsInstall(skillId: string, options: SkillInstallOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findEvbRoot();
  if (!workspaceRoot) {
    return outputError('Not inside an Ever-Brain project. Run `evb init <repo>` first.', 'NOT_IN_WORKSPACE', options);
  }

  try {
    let target = options.target;

    if (!target && !options.yes && process.stdout.isTTY) {
      const response = await prompts({
        type: 'select',
        name: 'target',
        message: `Select target agent environment for skill '${skillId}':`,
        choices: [
          { title: 'Universal Agent Standard (.agents/skills/ — Recommended)', value: 'agents' },
          { title: 'Cursor (.cursor/rules/)', value: 'cursor' },
          { title: 'Claude Code (.claude/skills/)', value: 'claude' },
          { title: 'Gemini (~/.gemini/skills/)', value: 'gemini' },
        ],
      });
      target = response.target;
    }

    const result = materializeService.materialize(workspaceRoot, skillId, {
      target: target || 'agents',
      global: options.global,
    });

    outputResult(result, options, () => {
      logger.success(`Materialized skill '${skillId}' for ${result.targetAgent}!`);
      logger.info(`Destination: ${result.destinationPath}`);
      logger.info(`Files installed: ${result.filesCopied}`);
      console.log(`\n💡 Your local AI agent now natively understands the '${skillId}' skill.`);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'SKILLS_INSTALL_ERROR', options);
  }
}
