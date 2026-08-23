import { exec } from 'node:child_process';
import pc from 'picocolors';
import { projectConfigManager } from '../config/project-config.js';
import { logger } from '../utils/logger.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';
import { emitTelemetry } from '../utils/telemetry.js';

export interface UiCommandOptions extends OutputOptions {
  open?: boolean;
  apiUrl?: string;
}

export function openBrowser(url: string): void {
  const platform = process.platform;
  let command = '';

  if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, () => {
    // Non-blocking browser launch
  });
}

export async function handleUi(options: UiCommandOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findEvbRoot() || undefined;
  const apiUrl = (options.apiUrl || projectConfigManager.getApiUrl(workspaceRoot)).replace(/\/+$/, '');
  const uiUrl = `${apiUrl}/ui`;

  try {
    // 1. Emit telemetry
    void emitTelemetry(
      {
        type: 'command_complete',
        command: 'ui',
        message: 'Opened Ever-Brain Live Visualizer',
        payload: { uiUrl },
      },
      workspaceRoot
    );

    // 2. Check API health quickly
    let isLive = false;
    try {
      const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) isLive = true;
    } catch {
      isLive = false;
    }

    // 3. Open in browser unless --no-open was specified
    const shouldOpen = options.open !== false;
    if (shouldOpen) {
      openBrowser(uiUrl);
    }

    outputResult(
      {
        status: isLive ? 'live' : 'offline',
        uiUrl,
        apiUrl,
        opened: shouldOpen,
      },
      options,
      () => {
        console.log(pc.bold(pc.cyan('\n🧠 Ever-Brain Live Intelligence Visualizer')));
        console.log(`────────────────────────────────────────────────────────────`);
        console.log(`  Visualizer URL:  ${pc.bold(pc.white(uiUrl))}`);
        console.log(`  API Target:      ${pc.dim(apiUrl)} ${isLive ? pc.green('(online)') : pc.yellow('(starting or offline)')}`);
        console.log(`  Real-Time Mode:  ${pc.green('SSE Stream + Smart Polling Fallback')}`);
        console.log(`────────────────────────────────────────────────────────────`);

        if (!isLive) {
          console.log(pc.yellow(`\n💡 Tip: Start the local servers with 'pnpm dev' if not already running.`));
        } else {
          console.log(pc.dim(`\n💡 The visualizer automatically updates in real time as you run 'evb' commands.`));
        }
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'UI_ERROR', options);
  }
}
