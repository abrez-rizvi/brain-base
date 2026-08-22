import prompts from 'prompts';
import { projectConfigManager } from '../config/project-config.js';
import { cacheService, computeSha256 } from '../services/cache-service.js';
import { authService } from '../services/auth-service.js';
import { parseRepoUrl } from '../services/sync-service.js';
import { githubWriterService, FileChange } from '../services/github-writer-service.js';
import { logger } from '../utils/logger.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';

export interface ProposeOptions extends OutputOptions {
  title?: string;
  message?: string;
  branch?: string;
  token?: string;
  yes?: boolean;
}

export async function handlePropose(options: ProposeOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findKnowikiRoot();
  if (!workspaceRoot) {
    return outputError(
      'Not inside a Knowiki project. Run `knowiki init <repo>` first.',
      'NOT_IN_WORKSPACE',
      options
    );
  }

  try {
    const config = projectConfigManager.readConfig(workspaceRoot);
    const { owner, repo } = parseRepoUrl(config.source.repository);
    const baseBranch = options.branch || config.source.branch;

    const dirty = cacheService.computeDirtyState(workspaceRoot);
    if (!dirty.isDirty) {
      outputResult({ status: 'clean', message: 'No local modifications to propose.' }, options, () => {
        logger.info('No local modifications to propose (working tree clean).');
      });
      return;
    }

    // 1. Resolve token
    let token = authService.resolveToken(options.token, workspaceRoot);
    if (!token) {
      if (!options.yes && process.stdout.isTTY) {
        const authRes = await authService.promptForAuth();
        token = authRes.token;
        authService.saveGlobalToken(token);
      } else {
        return outputError(
          'GitHub authentication required to open Pull Requests. Run `knowiki auth login` or pass --token.',
          'AUTH_REQUIRED',
          options
        );
      }
    }

    const userInfo = await authService.validateToken(token);

    // 2. PR Title & Message
    let title = options.title;
    let message = options.message;

    if (!title && !options.yes && process.stdout.isTTY) {
      const response = await prompts([
        {
          type: 'text',
          name: 'title',
          message: 'Enter Pull Request title:',
          validate: (v) => (v && v.trim().length > 0 ? true : 'PR title is required'),
        },
        {
          type: 'text',
          name: 'message',
          message: 'Enter Pull Request description / summary:',
        },
      ]);
      title = response.title;
      message = response.message || response.title;
    }

    if (!title) {
      title = 'Update Knowiki Project Intelligence';
    }
    if (!message) {
      message = title;
    }

    // 3. Build FileChanges payload
    const changes: FileChange[] = [];
    const updatedBaselineHashes: Record<string, string> = {
      ...(projectConfigManager.readState(workspaceRoot)?.files || {}),
    };

    for (const f of dirty.modified) {
      const content = cacheService.readCachedFile(workspaceRoot, f);
      if (content !== null) {
        changes.push({ path: f, content });
        updatedBaselineHashes[f] = computeSha256(content);
      }
    }

    for (const f of dirty.added) {
      const content = cacheService.readCachedFile(workspaceRoot, f);
      if (content !== null) {
        changes.push({ path: f, content });
        updatedBaselineHashes[f] = computeSha256(content);
      }
    }

    for (const f of dirty.deleted) {
      changes.push({ path: f, content: null });
      delete updatedBaselineHashes[f];
    }

    // 4. Create proposal branch & open PR
    logger.info(`Opening Pull Request against ${owner}/${repo} (${baseBranch})...`);
    const result = await githubWriterService.createProposalPullRequest(
      owner,
      repo,
      baseBranch,
      changes,
      title,
      message,
      token,
      userInfo.username
    );

    // 5. Update state.yaml to reflect proposed baseline
    projectConfigManager.writeState(workspaceRoot, {
      last_sync: new Date().toISOString(),
      source_revision: result.commitSha,
      cached_files: Object.keys(updatedBaselineHashes).length,
      files: updatedBaselineHashes,
    });

    outputResult(
      {
        status: 'proposed',
        pullRequestUrl: result.pullRequestUrl,
        pullRequestNumber: result.pullRequestNumber,
        branch: result.branch,
        commitSha: result.commitSha,
        isFork: result.isFork,
        filesChanged: changes.length,
      },
      options,
      () => {
        logger.success(`Opened Pull Request #${result.pullRequestNumber}!`);
        logger.info(`PR URL: ${logger.url(result.pullRequestUrl)}`);
        logger.info(`Branch: ${result.branch}${result.isFork ? ' (forked)' : ''}`);
        logger.success('Proposal submitted for team review.');
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'PROPOSE_ERROR', options);
  }
}
