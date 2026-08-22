import { Context } from 'hono';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '../server/mcp-server-factory.js';
import { parseRepoContext, RepoContext } from '../server/repo-context.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import crypto from 'node:crypto';

export interface StreamableSession {
  sessionId: string;
  transport: WebStandardStreamableHTTPServerTransport;
  server: Server;
  repoContext: RepoContext;
}

export const activeStreamableSessions = new Map<string, StreamableSession>();

export async function handleStreamableHttp(c: Context): Promise<Response> {
  const params = c.req.param();
  const queryRepo = c.req.query('repo') || c.req.query('repository');
  const repoContext = parseRepoContext(params, queryRepo);

  const sessionIdHeader = c.req.header('Mcp-Session-Id') || c.req.header('mcp-session-id');

  // Continuing existing session
  if (sessionIdHeader && activeStreamableSessions.has(sessionIdHeader)) {
    const session = activeStreamableSessions.get(sessionIdHeader)!;
    return session.transport.handleRequest(c.req.raw);
  }

  // New session initialization requires target repo context
  if (!repoContext) {
    return c.json(
      {
        error:
          "Target repository required. Specify via path (/mcp/:owner/:repo) or query (?repo=https://github.com/:owner/:repo)",
        code: 'INVALID_REPO_CONTEXT',
      },
      400
    );
  }

  const server = createMcpServer(repoContext);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (sessionId) => {
      activeStreamableSessions.set(sessionId, {
        sessionId,
        transport,
        server,
        repoContext,
      });
    },
    onsessionclosed: (sessionId) => {
      activeStreamableSessions.delete(sessionId);
    },
  });

  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
}

export async function handleStreamableHttpDelete(c: Context): Promise<Response> {
  return handleStreamableHttp(c);
}
