import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { cacheService } from './cache-service.js';

export interface MaterializeResult {
  skillId: string;
  targetAgent: string;
  destinationPath: string;
  filesCopied: number;
}

export class MaterializeService {
  materialize(
    workspaceRoot: string,
    skillId: string,
    options?: {
      target?: 'gemini' | 'cursor' | 'claude' | 'auto';
      global?: boolean;
    }
  ): MaterializeResult {
    const targetAgent = options?.target && options.target !== 'auto' ? options.target : 'gemini';
    const isGlobal = !!options?.global;

    // Locate skill in cache
    const skillDirRel = `skills/${skillId}`;
    const allCached = cacheService.listCachedFiles(workspaceRoot);
    const skillFiles = allCached.filter(
      (f) => f === `${skillDirRel}/SKILL.md` || f === `${skillDirRel}.md` || f.startsWith(`${skillDirRel}/`)
    );

    if (skillFiles.length === 0) {
      throw new Error(`Skill '${skillId}' not found in local cache. Run 'knowiki sync' to update.`);
    }

    let destDir = '';
    let primaryFile = '';

    if (targetAgent === 'gemini') {
      const base = isGlobal ? path.join(os.homedir(), '.gemini', 'skills') : path.join(workspaceRoot, '.gemini', 'skills');
      destDir = path.join(base, skillId);
      primaryFile = path.join(destDir, 'SKILL.md');
    } else if (targetAgent === 'cursor') {
      const base = isGlobal ? path.join(os.homedir(), '.cursor', 'rules') : path.join(workspaceRoot, '.cursor', 'rules');
      destDir = base;
      primaryFile = path.join(destDir, `${skillId}.mdc`);
    } else if (targetAgent === 'claude') {
      const base = isGlobal ? path.join(os.homedir(), '.claude', 'skills') : path.join(workspaceRoot, '.claude', 'skills');
      destDir = path.join(base, skillId);
      primaryFile = path.join(destDir, 'SKILL.md');
    }

    fs.mkdirSync(destDir, { recursive: true });

    let filesCopied = 0;

    for (const file of skillFiles) {
      const content = cacheService.readCachedFile(workspaceRoot, file);
      if (content === null) continue;

      if (targetAgent === 'cursor') {
        // For Cursor, write primary mdc rule
        if (file.endsWith('SKILL.md') || file === `${skillDirRel}.md`) {
          fs.writeFileSync(primaryFile, content, 'utf8');
          filesCopied++;
        }
      } else {
        // For Gemini & Claude, copy directory structure
        const subPath = file.startsWith(`${skillDirRel}/`)
          ? file.slice(`${skillDirRel}/`.length)
          : 'SKILL.md';

        const targetFilePath = path.join(destDir, subPath);
        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        fs.writeFileSync(targetFilePath, content, 'utf8');
        filesCopied++;
      }
    }

    return {
      skillId,
      targetAgent,
      destinationPath: targetAgent === 'cursor' ? primaryFile : destDir,
      filesCopied,
    };
  }
}

export const materializeService = new MaterializeService();
