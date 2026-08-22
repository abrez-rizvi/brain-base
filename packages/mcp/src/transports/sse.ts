import { Context } from 'hono';
import { streamSSE, SSEStreamingApi } from 'hono/streaming';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage, MessageExtraInfo } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from '../server/mcp-server-factory.js';
import { parseRepoContext, RepoContext } from '../server/repo-context.js';
import crypto from 'node:crypto';

export interface SseSession {
  sessionId: string;
  repoContext: RepoContext;
  transport: SseHonoTransport;
}

export class SseHonoTransport implements Transport {
  public sessionId: string;
  private endpointUrl: string;
  private stream?: SSEStreamingApi;
  private closed = false;

  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;

  constructor(sessionId: string, endpointUrl: string) {
    this.sessionId = sessionId;
    this.endpointUrl = endpointUrl;
  }

  setStream(stream: SSEStreamingApi): void {
    this.stream = stream;
  }

  async start(): Promise<void> {
    if (this.stream) {
      await this.stream.writeSSE({
        event: 'endpoint',
        data: this.endpointUrl,
      });
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.closed || !this.stream) return;
    try {
      await this.stream.writeSSE({
        event: 'message',
        data: JSON.stringify(message),
      });
    } catch (err: unknown) {
      if (this.onerror) {
        this.onerror(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  async receiveMessage(message: JSONRPCMessage, extra?: MessageExtraInfo): Promise<void> {
    if (this.onmessage) {
      this.onmessage(message, extra);
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.onclose) {
      this.onclose();
    }
  }
}

export const activeSseSessions = new Map<string, SseSession>();

export async function handleSseConnect(c: Context): Promise<Response> {
  const params = c.req.param();
  const queryRepo = c.req.query('repo') || c.req.query('repository');
  const repoContext = parseRepoContext(params, queryRepo);

  if (!repoContext) {
    return c.json(
      {
        error:
          "Target repository required. Specify via path (/sse/:owner/:repo) or query (?repo=https://github.com/:owner/:repo)",
        code: 'INVALID_REPO_CONTEXT',
      },
      400
    );
  }

  const sessionId = crypto.randomUUID();

  // Determine full absolute endpoint URL with repo prefix for client compatibility
  const host = c.req.header('x-forwarded-host') || c.req.header('host') || new URL(c.req.url).host;
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const proto = isLocal ? (c.req.url.startsWith('https') ? 'https' : 'http') : 'https';
  const prefixPath = `/sse/${encodeURIComponent(repoContext.owner)}/${encodeURIComponent(repoContext.repo)}/messages`;
  const endpointUrl = `${proto}://${host}${prefixPath}?sessionId=${encodeURIComponent(sessionId)}`;

  const transport = new SseHonoTransport(sessionId, endpointUrl);
  const server = createMcpServer(repoContext);

  await server.connect(transport);

  activeSseSessions.set(sessionId, {
    sessionId,
    repoContext,
    transport,
  });

  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache, no-transform');
  c.header('Connection', 'keep-alive');
  c.header('X-Accel-Buffering', 'no');

  return streamSSE(c, async (stream) => {
    transport.setStream(stream);
    await stream.write(': connected\n\n');
    await transport.start();

    stream.onAbort(() => {
      transport.close();
      activeSseSessions.delete(sessionId);
    });

    while (!stream.aborted) {
      await stream.sleep(15000);
      try {
        await stream.write(': keepalive\n\n');
      } catch {
        break;
      }
    }
  });
}

export async function handleSseMessage(c: Context): Promise<Response> {
  let body: any;
  try {
    body = await c.req.json();
  } catch (err: unknown) {
    return c.json({ error: 'Invalid JSON-RPC payload', code: 'INVALID_PAYLOAD' }, 400);
  }

  const sessionId =
    c.req.query('sessionId') ||
    c.req.query('session_id') ||
    c.req.header('Mcp-Session-Id') ||
    c.req.header('mcp-session-id');

  const session = sessionId ? activeSseSessions.get(sessionId) : undefined;

  // 1. Antigravity plugin discovery probe
  if (body?.method === 'server/discover') {
    return c.json({
      jsonrpc: '2.0',
      id: body.id ?? 1,
      result: {
        name: 'knowiki-mcp',
        version: '1.0.0',
        capabilities: {
          resources: { subscribe: false, listChanged: false },
          tools: { listChanged: false },
        },
      },
    });
  }

  // 2. Initialize request (returns JSON-RPC result directly for HTTP-expecting clients AND emits to SSE)
  if (body?.method === 'initialize') {
    if (session) {
      void session.transport.receiveMessage(body);
    }
    return c.json({
      jsonrpc: '2.0',
      id: body.id ?? 1,
      result: {
        protocolVersion: body.params?.protocolVersion || '2024-11-05',
        capabilities: {
          resources: { subscribe: false, listChanged: false },
          tools: { listChanged: false },
        },
        serverInfo: {
          name: 'knowiki-mcp',
          version: '1.0.0',
        },
      },
    });
  }

  // 3. Initialized notification
  if (body?.method === 'notifications/initialized' || body?.method === 'initialized') {
    if (session) {
      void session.transport.receiveMessage(body);
    }
    return c.json({ jsonrpc: '2.0' }, 200);
  }

  // 4. Tools list request
  if (body?.method === 'tools/list') {
    if (session) {
      void session.transport.receiveMessage(body);
    }
    return c.json({
      jsonrpc: '2.0',
      id: body.id ?? 1,
      result: {
        tools: [
          {
            name: 'list_files',
            description:
              'List discoverable project intelligence, knowledge, skills, and documentation in the repository',
            inputSchema: {
              type: 'object',
              properties: {
                filter_extension: {
                  type: 'string',
                  description: "Optional file extension filter (e.g. '.md', '.ts', '.json')",
                },
                path_prefix: {
                  type: 'string',
                  description: "Optional directory prefix filter (e.g. 'knowledge/', 'skills/')",
                },
              },
            },
          },
          {
            name: 'read_file',
            description:
              'Read the exact content of a project file, knowledge document, or skill runbook from the repository',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description:
                    "Path to the file in the repository (e.g. 'README.md', 'knowledge/architecture.md', 'skills/testing/SKILL.md')",
                },
              },
              required: ['path'],
            },
          },
          {
            name: 'search_files',
            description:
              'Search across project text and Markdown files for a specific query string or keyword',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Query string or keyword to search across repository files',
                },
                path_prefix: {
                  type: 'string',
                  description: "Optional directory prefix to limit search scope (e.g. 'skills/')",
                },
              },
              required: ['query'],
            },
          },
        ],
      },
    });
  }

  // 5. Default handler for active session
  if (!session) {
    return c.json(
      { error: `SSE Session '${sessionId || 'unknown'}' not found or has expired`, code: 'SESSION_NOT_FOUND' },
      404
    );
  }

  try {
    await session.transport.receiveMessage(body);
    return c.json({ jsonrpc: '2.0', id: body.id ?? null, status: 'ok' }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid JSON-RPC payload';
    return c.json({ error: message, code: 'INVALID_PAYLOAD' }, 400);
  }
}
