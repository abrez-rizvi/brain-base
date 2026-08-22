import pc from 'picocolors';
import { createTwoFilesPatch } from 'diff';
import { projectConfigManager } from '../config/project-config.js';
import { cacheService, normalizePosixPath } from '../services/cache-service.js';
import { CliApiClient } from '../client/api-client.js';
import { parseRepoUrl } from '../services/sync-service.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';

export interface DiffEntry {
  file: string;
  type: 'modified' | 'added' | 'deleted';
  patch: string;
}

export async function handleDiff(
  targetPath?: string,
  options: OutputOptions = {}
): Promise<void> {
  const workspaceRoot = projectConfigManager.findKnowikiRoot();
  if (!workspaceRoot) {
    return outputError(
      'Not inside a Knowiki project. Run `knowiki init <repo>` first.',
      'NOT_IN_WORKSPACE',
      options
    );
  }

  try {
    const config = projectConfigManager.readConfig(workspaceRoot);
    const state = projectConfigManager.readState(workspaceRoot);
    const dirty = cacheService.computeDirtyState(workspaceRoot);

    const { owner, repo } = parseRepoUrl(config.source.repository);
    const targetBranch = config.source.branch;
    const apiUrl = projectConfigManager.getApiUrl(workspaceRoot);
    const client = new CliApiClient(apiUrl);

    let filesToDiff: Array<{ file: string; type: 'modified' | 'added' | 'deleted' }> = [];

    if (targetPath) {
      const cleanTarget = normalizePosixPath(targetPath);
      if (dirty.modified.includes(cleanTarget)) {
        filesToDiff.push({ file: cleanTarget, type: 'modified' });
      } else if (dirty.added.includes(cleanTarget)) {
        filesToDiff.push({ file: cleanTarget, type: 'added' });
      } else if (dirty.deleted.includes(cleanTarget)) {
        filesToDiff.push({ file: cleanTarget, type: 'deleted' });
      } else {
        // Unmodified
        outputResult({ diffs: [], message: `File '${cleanTarget}' is clean.` }, options, () => {
          console.log(`File '${cleanTarget}' has no uncommitted modifications.`);
        });
        return;
      }
    } else {
      for (const m of dirty.modified) filesToDiff.push({ file: m, type: 'modified' });
      for (const a of dirty.added) filesToDiff.push({ file: a, type: 'added' });
      for (const d of dirty.deleted) filesToDiff.push({ file: d, type: 'deleted' });
    }

    if (filesToDiff.length === 0) {
      outputResult({ diffs: [], isDirty: false }, options, () => {
        console.log(pc.green('No local modifications (working tree clean).'));
      });
      return;
    }

    const diffEntries: DiffEntry[] = [];

    for (const item of filesToDiff) {
      let oldContent = '';
      let newContent = '';

      if (item.type === 'modified') {
        try {
          const remote = await client.getFileContent(owner, repo, item.file, targetBranch);
          oldContent = remote.content;
        } catch {
          oldContent = '';
        }
        newContent = cacheService.readCachedFile(workspaceRoot, item.file) || '';
      } else if (item.type === 'added') {
        oldContent = '';
        newContent = cacheService.readCachedFile(workspaceRoot, item.file) || '';
      } else if (item.type === 'deleted') {
        try {
          const remote = await client.getFileContent(owner, repo, item.file, targetBranch);
          oldContent = remote.content;
        } catch {
          oldContent = '';
        }
        newContent = '';
      }

      const patch = createTwoFilesPatch(
        `a/${item.file}`,
        `b/${item.file}`,
        oldContent,
        newContent,
        `remote:${targetBranch}`,
        'local:cache'
      );

      diffEntries.push({
        file: item.file,
        type: item.type,
        patch,
      });
    }

    outputResult({ diffs: diffEntries, isDirty: true }, options, () => {
      for (const entry of diffEntries) {
        console.log(pc.bold(pc.cyan(`\n--- diff: ${entry.file} (${entry.type}) ---`)));
        const lines = entry.patch.split('\n');
        for (const line of lines) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            console.log(pc.green(line));
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            console.log(pc.red(line));
          } else if (line.startsWith('@@')) {
            console.log(pc.cyan(line));
          } else {
            console.log(pc.dim(line));
          }
        }
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'DIFF_ERROR', options);
  }
}
