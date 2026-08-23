import pc from 'picocolors';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { isBinaryOrIgnoredFile, BINARY_EXTENSIONS } from '@ever-brain/api/utils/binary-filter.js';
import { projectConfigManager } from '../config/project-config.js';
import { cacheService, normalizePosixPath } from '../services/cache-service.js';
import { CliApiClient } from '../client/api-client.js';
import { parseRepoUrl } from '../services/sync-service.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';
import { emitTelemetry } from '../utils/telemetry.js';

export interface DiffEntry {
  file: string;
  type: 'modified' | 'added' | 'deleted';
  patch: string;
  isBinary?: boolean;
  oldSizeBytes?: number;
  newSizeBytes?: number;
  crlfNormalized?: boolean;
  foldedLinesCount?: number;
}

export interface DiffCommandOptions extends OutputOptions {
  full?: boolean;
  rawCrlf?: boolean;
}

export function isBinaryContent(content: string, filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  // Null byte inspection for raw binary content
  if (content.includes('\0')) return true;
  return false;
}

export function normalizeCrlf(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

export async function handleDiff(
  targetPath?: string,
  options: DiffCommandOptions = {}
): Promise<void> {
  const workspaceRoot = projectConfigManager.findEvbRoot();
  if (!workspaceRoot) {
    return outputError(
      'Not inside an Ever-Brain project. Run `evb init <repo>` first.',
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
      void emitTelemetry(
        {
          type: 'diff',
          command: 'diff',
          message: 'No local modifications (clean)',
          payload: { dirtyCount: 0 },
        },
        workspaceRoot
      );

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

      const oldSizeBytes = Buffer.byteLength(oldContent, 'utf8');
      const newSizeBytes = Buffer.byteLength(newContent, 'utf8');

      // Edge Case 1: Binary Asset Handling
      if (isBinaryContent(newContent, item.file) || isBinaryContent(oldContent, item.file)) {
        diffEntries.push({
          file: item.file,
          type: item.type,
          patch: `Binary files a/${item.file} and b/${item.file} differ (${oldSizeBytes} B -> ${newSizeBytes} B)`,
          isBinary: true,
          oldSizeBytes,
          newSizeBytes,
        });
        continue;
      }

      // Edge Case 2: CRLF Normalization
      let crlfNormalized = false;
      let effectiveOld = oldContent;
      let effectiveNew = newContent;

      if (!options.rawCrlf) {
        if (oldContent.includes('\r\n') || newContent.includes('\r\n')) {
          effectiveOld = normalizeCrlf(oldContent);
          effectiveNew = normalizeCrlf(newContent);
          crlfNormalized = true;
        }
      }

      const patch = createTwoFilesPatch(
        `a/${item.file}`,
        `b/${item.file}`,
        effectiveOld,
        effectiveNew,
        `remote:${targetBranch}`,
        'local:cache'
      );

      diffEntries.push({
        file: item.file,
        type: item.type,
        patch,
        isBinary: false,
        oldSizeBytes,
        newSizeBytes,
        crlfNormalized,
      });
    }

    void emitTelemetry(
      {
        type: 'diff',
        command: 'diff',
        message: `Generated diffs for ${diffEntries.length} file(s)`,
        payload: {
          diffCount: diffEntries.length,
          files: diffEntries.map((d) => d.file),
        },
      },
      workspaceRoot
    );

    outputResult({ diffs: diffEntries, isDirty: true }, options, () => {
      for (const entry of diffEntries) {
        // Binary Asset Display
        if (entry.isBinary) {
          console.log(pc.bold(pc.yellow(`\n--- [BINARY ASSET] ${entry.file} (${entry.type}) ---`)));
          console.log(
            pc.dim(
              `  Binary payload safely isolated. Delta: ${entry.oldSizeBytes || 0} B -> ${entry.newSizeBytes || 0} B (${((entry.newSizeBytes || 0) - (entry.oldSizeBytes || 0)) >= 0 ? '+' : ''}${((entry.newSizeBytes || 0) - (entry.oldSizeBytes || 0))} B)`
            )
          );
          continue;
        }

        const crlfBadge = entry.crlfNormalized ? pc.dim(' [CRLF normalized]') : '';
        console.log(pc.bold(pc.cyan(`\n--- diff: ${entry.file} (${entry.type})${crlfBadge} ---`)));

        const lines = entry.patch.split('\n');
        const maxLines = options.full ? lines.length : 120;
        const displayLines = lines.slice(0, maxLines);

        for (const line of displayLines) {
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

        // Edge Case 3: Truncation threshold indicator
        if (lines.length > maxLines) {
          const omitted = lines.length - maxLines;
          console.log(
            pc.yellow(
              `\n  ... [${omitted} lines folded; use 'evb diff --full' to view complete diff]`
            )
          );
        }
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'DIFF_ERROR', options);
  }
}
