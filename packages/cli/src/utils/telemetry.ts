import { projectConfigManager } from '../config/project-config.js';

export interface TelemetryEvent {
  type:
    | 'command_start'
    | 'command_progress'
    | 'command_complete'
    | 'command_error'
    | 'file_change'
    | 'sync'
    | 'diff'
    | 'status_update';
  command?: string;
  message?: string;
  payload?: Record<string, any>;
  timestamp?: string;
}

/**
 * Dispatches non-blocking, fire-and-forget telemetry events to the local Ever-Brain UI Event Hub.
 * Strictly wrapped in try/catch with a 150ms abort timeout so offline/hosted CLI usage never stalls.
 */
export async function emitTelemetry(
  event: TelemetryEvent,
  workspaceRoot?: string
): Promise<void> {
  const root = workspaceRoot || projectConfigManager.findEvbRoot() || undefined;
  const apiUrl = projectConfigManager.getApiUrl(root);

  if (!apiUrl) return;

  const endpoint = `${apiUrl.replace(/\/+$/, '')}/ui/events`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 150);

  try {
    const payload = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch(() => {
      // Ignored: non-blocking fire-and-forget
    });
  } catch {
    // Complete failure isolation
  } finally {
    clearTimeout(timeoutId);
  }
}
