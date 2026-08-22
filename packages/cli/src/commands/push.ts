import prompts from 'prompts';
import { projectConfigManager } from '../config/project-config.js';
import { cacheService, computeSha256 } from '../services/cache-service.js';
import { authService } from '../services/auth-service.js';
import { parseRepoUrl } from '../services/sync-service.js';
import { githubWriterService, FileChange } from '../services/github-writer-service.js';
import { logger } from '../utils/logger.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';

export interface PushOptions extends OutputOptions {
  message?: string;
  branch?: string;
  token?: string;
  yes?: boolean;
}

export async function handlePush(options: PushOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findEvbRoot();
  if (!workspaceRoot) {
    return outputError(
      'Not inside an Ever-Brain project. Run `evb init <repo>` first.',
      'NOT_IN_WORKSPACE',
      options
    );
  }

  try {
    const config = projectConfigManager.readConfig(workspaceRoot);
    const { owner, repo } = parseRepoUrl(config.source.repository);
    const targetBranch = options.branch || config.source.branch;

    const dirty = cacheService.computeDirtyState(workspaceRoot);
    if (!dirty.isDirty) {
      outputResult({ status: 'clean', message: 'No local modifications to push.' }, options, () => {
        logger.info('No local modifications to push (working tree clean).');
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
          'GitHub authentication required. Run `evb auth login` or pass --token / GITHUB_TOKEN.',
          'AUTH_REQUIRED',
          options
        );
      }
    }

    // 2. Validate user identity and repo permissions
    const userInfo = await authService.validateToken(token);
    const permission = await authService.getRepoPermission(owner, repo, userInfo.username, token);

    if (permission !== 'admin' && permission !== 'write') {
      return outputError(
        `User @${userInfo.username} has '${permission}' access on ${owner}/${repo} (write permission required for direct push).\nUse 'evb propose' to open a Pull Request for team review.`,
        'PERMISSION_DENIED',
        options
      );
    }

    // 3. Commit message
    let commitMessage = options.message;
    if (!commitMessage) {
      if (!options.yes && process.stdout.isTTY) {
        const msgRes = await prompts({
          type: 'text',
          name: 'msg',
          message: 'Enter commit message:',
          validate: (v) => (v && v.trim().length > 0 ? true : 'Commit message cannot be empty'),
        });
        commitMessage = msgRes.msg;
      }
      if (!commitMessage) {
        commitMessage = 'Update project intelligence via Ever-Brain';
      }
    }

    // 4. Build FileChanges payload
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

    // 5. Push direct commit to GitHub
    logger.info(`Pushing ${changes.length} file change(s) directly to ${owner}/${repo} (${targetBranch})...`);
    const result = await githubWriterService.createDirectCommit(
      owner,
      repo,
      targetBranch,
      changes,
      commitMessage,
      token
    );

    // 6. Update local state.yaml to reflect new baseline
    projectConfigManager.writeState(workspaceRoot, {
      last_sync: new Date().toISOString(),
      source_revision: result.commitSha,
      cached_files: Object.keys(updatedBaselineHashes).length,
      files: updatedBaselineHashes,
    });

    outputResult(
      {
        status: 'pushed',
        commitSha: result.commitSha,
        branch: result.branch,
        commitUrl: result.commitUrl,
        filesChanged: changes.length,
      },
      options,
      () => {
        logger.success(`Pushed commit ${result.commitSha.slice(0, 7)} to branch '${result.branch}'!`);
        logger.info(`Commit URL: ${logger.url(result.commitUrl)}`);
        logger.success('Local working tree is now clean.');
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'PUSH_ERROR', options);
  }
}
