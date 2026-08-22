import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ApiClient, apiClient as defaultApiClient } from '../client/api-client.js';
import { RepoContext } from './repo-context.js';

const ServerDiscoverSchema = z.object({
  method: z.literal('server/discover'),
  params: z.record(z.unknown()).optional(),
});

export function createMcpServer(
  repoContext: RepoContext,
  client: ApiClient = defaultApiClient
): Server {
  const server = new Server(
    {
      name: 'knowiki-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        resources: {
          subscribe: false,
          listChanged: false,
        },
        tools: {
          listChanged: false,
        },
      },
    }
  );

  // --- 0. Antigravity plugin probe: server/discover ---
  server.setRequestHandler(ServerDiscoverSchema, async () => {
    return {
      name: 'knowiki-mcp',
      version: '1.0.0',
      capabilities: {
        resources: {
          subscribe: false,
          listChanged: false,
        },
        tools: {
          listChanged: false,
        },
      },
    };
  });

  // --- 1. Resources: list ---
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      const filesRes = await client.getFiles(repoContext.owner, repoContext.repo);
      return {
        resources: filesRes.files.map((file) => ({
          uri: `knowiki://repo/${file.path}`,
          name: file.path,
          description: `${file.path} in ${repoContext.owner}/${repoContext.repo}`,
          mimeType: file.mimeType,
        })),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list resources';
      throw new McpError(ErrorCode.InternalError, message);
    }
  });

  // --- 2. Resources: read ---
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const prefixMatch = uri.match(/^knowiki:\/\/(?:repo\/)?(.+)$/);

    if (!prefixMatch) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid URI format '${uri}'. Expected 'knowiki://repo/{path}'`
      );
    }

    const filePath = prefixMatch[1];
    try {
      const fileRes = await client.getFileContent(
        repoContext.owner,
        repoContext.repo,
        filePath
      );

      return {
        contents: [
          {
            uri,
            mimeType: fileRes.mimeType,
            text: fileRes.content,
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `File '${filePath}' not found`;
      throw new McpError(ErrorCode.InvalidRequest, message);
    }
  });

  // --- 3. Tools: list ---
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
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
    };
  });

  // --- 4. Tools: call ---
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      if (name === 'list_files') {
        const prefix = typeof args.path_prefix === 'string' ? args.path_prefix : undefined;
        const ext =
          typeof args.filter_extension === 'string'
            ? args.filter_extension.toLowerCase()
            : undefined;

        const filesRes = await client.getFiles(
          repoContext.owner,
          repoContext.repo,
          prefix
        );

        let filtered = filesRes.files;
        if (ext) {
          filtered = filtered.filter((f) => f.path.toLowerCase().endsWith(ext));
        }

        const summary = filtered.map((f) => ({
          path: f.path,
          sizeBytes: f.sizeBytes,
          mimeType: f.mimeType,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  repository: `${repoContext.owner}/${repoContext.repo}`,
                  branch: filesRes.branch,
                  totalFiles: summary.length,
                  files: summary,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (name === 'read_file') {
        const filePath = typeof args.path === 'string' ? args.path : '';
        if (!filePath) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: "Argument 'path' is required for tool read_file.",
              },
            ],
          };
        }

        const fileRes = await client.getFileContent(
          repoContext.owner,
          repoContext.repo,
          filePath
        );

        return {
          content: [
            {
              type: 'text',
              text: fileRes.content,
            },
          ],
        };
      }

      if (name === 'search_files') {
        const query = typeof args.query === 'string' ? args.query : '';
        const prefix = typeof args.path_prefix === 'string' ? args.path_prefix : undefined;

        if (!query) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: "Argument 'query' is required for tool search_files.",
              },
            ],
          };
        }

        const searchRes = await client.searchFiles(
          repoContext.owner,
          repoContext.repo,
          query,
          prefix
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(searchRes, null, 2),
            },
          ],
        };
      }

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool '${name}'. Available tools: list_files, read_file, search_files.`,
          },
        ],
      };
    } catch (err: unknown) {
      // Return safe tool error content instead of throwing JSON-RPC error
      const message = err instanceof Error ? err.message : 'Tool execution error';
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${message}`,
          },
        ],
      };
    }
  });

  return server;
}
