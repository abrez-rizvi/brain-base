import { projectConfigManager } from '../config/project-config.js';
import { syncService } from '../services/sync-service.js';
import { logger } from '../utils/logger.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';
import { emitTelemetry } from '../utils/telemetry.js';

export interface SyncCommandOptions extends OutputOptions {
  force?: boolean;
}

export async function handleSync(options: SyncCommandOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findEvbRoot();
  if (!workspaceRoot) {
    return outputError(
      'Not inside an Ever-Brain project. Run `evb init <repo>` first.',
      'NOT_IN_WORKSPACE',
      options
    );
  }

  try {
    void emitTelemetry(
      {
        type: 'command_start',
        command: 'sync',
        message: 'Synchronizing intelligence repository into local cache...',
      },
      workspaceRoot
    );

    const result = await syncService.sync(workspaceRoot, { force: options.force });

    void emitTelemetry(
      {
        type: 'sync',
        command: 'sync',
        message: `Sync complete: ${result.updated} updated, ${result.unchanged} unchanged, ${result.total} total files`,
        payload: result,
      },
      workspaceRoot
    );

    outputResult(result, options, () => {
      logger.success(`Ever-Brain sync complete!`);
      console.log(`  • Updated:   ${result.updated} files`);
      console.log(`  • Unchanged: ${result.unchanged} files`);
      if (result.removed > 0) {
        console.log(`  • Removed:   ${result.removed} files`);
      }
      console.log(`  • Total:     ${result.total} cached files`);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    void emitTelemetry(
      {
        type: 'command_error',
        command: 'sync',
        message: `Sync error: ${message}`,
      },
      workspaceRoot
    );
    outputError(message, 'SYNC_ERROR', options);
  }
}
