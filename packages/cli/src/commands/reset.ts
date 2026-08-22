import prompts from 'prompts';
import { projectConfigManager } from '../config/project-config.js';
import { cacheService } from '../services/cache-service.js';
import { syncService } from '../services/sync-service.js';
import { logger } from '../utils/logger.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';

export interface ResetOptions extends OutputOptions {
  yes?: boolean;
}

export async function handleReset(options: ResetOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findKnowikiRoot();
  if (!workspaceRoot) {
    return outputError(
      'Not inside a Knowiki project. Run `knowiki init <repo>` first.',
      'NOT_IN_WORKSPACE',
      options
    );
  }

  const dirty = cacheService.computeDirtyState(workspaceRoot);
  if (!dirty.isDirty) {
    outputResult({ status: 'clean', message: 'Working tree is already clean.' }, options, () => {
      logger.info('Working tree is already clean. Nothing to reset.');
    });
    return;
  }

  if (!options.yes && process.stdout.isTTY) {
    const totalCount = dirty.modified.length + dirty.added.length + dirty.deleted.length;
    const response = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Discard all ${totalCount} uncommitted local modifications and reset to remote baseline?`,
      initial: false,
    });

    if (!response.confirm) {
      logger.info('Reset cancelled.');
      return;
    }
  }

  try {
    // Re-sync with force=true to restore baseline
    const syncRes = await syncService.sync(workspaceRoot, { force: true });

    outputResult(
      {
        status: 'reset_complete',
        filesRestored: syncRes.total,
      },
      options,
      () => {
        logger.success('Local modifications discarded. Reset to clean remote baseline complete.');
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'RESET_ERROR', options);
  }
}
