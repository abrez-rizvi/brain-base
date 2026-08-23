import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { uiEventHub } from '../services/ui-event-hub.js';
import { uiStateService } from '../services/ui-state-service.js';
import { getVisualizerHtml } from '../views/visualizer-template.js';

export const uiRouter = new Hono();

// GET /ui — Serve Embedded Visualizer HTML
uiRouter.get('/', (c) => {
  const html = getVisualizerHtml();
  return c.html(html);
});

// GET /ui/state — Current Knowledge Graph & System Snapshot
uiRouter.get('/state', async (c) => {
  const repoParam = c.req.query('repo') || c.req.query('repository') || 'spencerpauly/skills-repo';
  const branch = c.req.query('branch');

  let owner = 'spencerpauly';
  let repo = 'skills-repo';

  if (repoParam.includes('/')) {
    const parts = repoParam.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').split('/');
    if (parts.length >= 2) {
      owner = parts[0];
      repo = parts[1];
    }
  }

  try {
    const snapshot = await uiStateService.buildSnapshot(owner, repo, branch);
    return c.json(snapshot);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to build state snapshot';
    return c.json({ error: message, code: 'STATE_ERROR' }, 500);
  }
});

// GET /ui/events — Server-Sent Events (SSE) Real-Time Stream
uiRouter.get('/events', async (c) => {
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('Connection', 'keep-alive');
  c.header('X-Accel-Buffering', 'no');

  return streamSSE(c, async (stream) => {
    // 1. Initial connection handshake
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({
        status: 'connected',
        rev: uiEventHub.getRevision(),
        timestamp: new Date().toISOString(),
      }),
    });

    // 2. Subscribe to internal event hub
    const unsubscribe = uiEventHub.subscribe(async (event) => {
      try {
        await stream.writeSSE({
          event: 'message',
          data: JSON.stringify(event),
        });
      } catch {
        // Client stream closed
      }
    });

    stream.onAbort(() => {
      unsubscribe();
    });

    // 3. Heartbeat loop (every 15s)
    while (!stream.aborted) {
      await stream.sleep(15000);
      try {
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ rev: uiEventHub.getRevision(), timestamp: new Date().toISOString() }),
        });
      } catch {
        break;
      }
    }
  });
});

// POST /ui/events — Non-Blocking Telemetry Ingest from CLI
uiRouter.post('/events', async (c) => {
  try {
    const body = await c.req.json();
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid event payload', code: 'INVALID_PAYLOAD' }, 400);
    }

    const event = uiEventHub.emitEvent({
      type: body.type || 'status_update',
      command: body.command,
      message: body.message,
      payload: body.payload || {},
      timestamp: body.timestamp,
    });

    return c.json({ status: 'ok', id: event.id, rev: event.rev });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error processing event';
    return c.json({ error: message, code: 'EVENT_INGEST_ERROR' }, 400);
  }
});

// GET /ui/export/md — Download Markdown Audit Report
uiRouter.get('/export/md', async (c) => {
  const repoParam = c.req.query('repo') || c.req.query('repository') || 'spencerpauly/skills-repo';
  const branch = c.req.query('branch');

  let owner = 'spencerpauly';
  let repo = 'skills-repo';

  if (repoParam.includes('/')) {
    const parts = repoParam.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').split('/');
    if (parts.length >= 2) {
      owner = parts[0];
      repo = parts[1];
    }
  }

  try {
    const snapshot = await uiStateService.buildSnapshot(owner, repo, branch);
    const markdown = uiStateService.generateAuditMarkdown(snapshot);

    return c.text(markdown, 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="EVER_BRAIN_AUDIT.md"',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export markdown audit';
    return c.text(`# Ever-Brain Audit Error\n\n${message}`, 500);
  }
});
