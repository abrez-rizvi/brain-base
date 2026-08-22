import { projectConfigManager } from '../config/project-config.js';
import { parseRepoUrl } from '../services/sync-service.js';
import { getDefaultMcpUrl } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';

export interface McpCommandOptions extends OutputOptions {
  mcpUrl?: string;
}

export async function handleMcp(repoUrlArg?: string, options: McpCommandOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findEvbRoot() || undefined;

  let owner: string;
  let repo: string;

  if (repoUrlArg) {
    try {
      const parsed = parseRepoUrl(repoUrlArg);
      owner = parsed.owner;
      repo = parsed.repo;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return outputError(message, 'INVALID_ARGS', options);
    }
  } else if (workspaceRoot) {
    try {
      const config = projectConfigManager.readConfig(workspaceRoot);
      const parsed = parseRepoUrl(config.source.repository);
      owner = parsed.owner;
      repo = parsed.repo;
    } catch {
      return outputError('Could not read repository from .evb/config.yaml. Provide repo: evb mcp <owner/repo>', 'CONFIG_ERROR', options);
    }
  } else {
    return outputError('Not in an Ever-Brain workspace. Specify repo: evb mcp <owner/repo>', 'NOT_INITIALIZED', options);
  }

  const baseMcpUrl = (options.mcpUrl || getDefaultMcpUrl()).replace(/\/+$/, '');
  const streamableHttpUrl = `${baseMcpUrl}/mcp/${owner}/${repo}`;
  const sseUrl = `${baseMcpUrl}/sse/${owner}/${repo}`;

  const claudeCommand = `claude mcp add ever-brain -- ${streamableHttpUrl}`;
  const cursorConfig = {
    mcpServers: {
      'ever-brain': {
        url: streamableHttpUrl,
      },
    },
  };
  const antigravityConfig = {
    mcpServers: {
      'ever-brain': {
        url: sseUrl,
      },
    },
  };

  outputResult(
    {
      repository: `${owner}/${repo}`,
      streamableHttpUrl,
      sseUrl,
      configs: {
        claude: claudeCommand,
        cursor: cursorConfig,
        antigravity: antigravityConfig,
      },
    },
    options,
    () => {
      console.log(`\n✨ Ever-Brain MCP Server Endpoints for ${owner}/${repo}\n`);
      logger.info(`Streamable HTTP (MCP 2025-03-26):`);
      console.log(`   ${streamableHttpUrl}\n`);
      logger.info(`Legacy SSE (MCP 2024-11-05):`);
      console.log(`   ${sseUrl}\n`);
      console.log(`────────────────────────────────────────────────────────────`);
      console.log(`📋 Ready-to-paste Agent Configurations:\n`);
      console.log(`• Claude Code:`);
      console.log(`  ${claudeCommand}\n`);
      console.log(`• Cursor (~/.cursor/mcp.json):`);
      console.log(`  ${JSON.stringify(cursorConfig, null, 2).split('\n').map((l) => '  ' + l).join('\n')}\n`);
      console.log(`• Antigravity / Gemini (.agents/mcp_config.json):`);
      console.log(`  ${JSON.stringify(antigravityConfig, null, 2).split('\n').map((l) => '  ' + l).join('\n')}`);
      console.log(`────────────────────────────────────────────────────────────\n`);
    }
  );
}
