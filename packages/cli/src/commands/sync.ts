import { projectConfigManager } from '../config/project-config.js';
import { syncService } from '../services/sync-service.js';
import { logger } from '../utils/logger.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';

export interface SyncCommandOptions extends OutputOptions {
  force?: boolean;
}

export async function handleSync(options: SyncCommandOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findKnowikiRoot();
  if (!workspaceRoot) {
    return outputError(
      'Not inside a Knowiki project. Run `knowiki init <repo>` first.',
      'NOT_IN_WORKSPACE',
      options
    );
  }

  try {
    const result = await syncService.sync(workspaceRoot, { force: options.force });

    outputResult(result, options, () => {
      logger.success(`Knowiki sync complete!`);
      console.log(`  • Updated:   ${result.updated} files`);
      console.log(`  • Unchanged: ${result.unchanged} files`);
      if (result.removed > 0) {
        console.log(`  • Removed:   ${result.removed} files`);
      }
      console.log(`  • Total:     ${result.total} cached files`);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'SYNC_ERROR', options);
  }
}
