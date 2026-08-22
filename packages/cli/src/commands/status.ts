import pc from 'picocolors';
import { projectConfigManager } from '../config/project-config.js';
import { cacheService } from '../services/cache-service.js';
import { authService } from '../services/auth-service.js';
import { parseRepoUrl } from '../services/sync-service.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';

export async function handleStatus(options: OutputOptions = {}): Promise<void> {
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
    const state = projectConfigManager.readState(workspaceRoot);
    const dirty = cacheService.computeDirtyState(workspaceRoot);
    const cachedFiles = cacheService.listCachedFiles(workspaceRoot);

    const { owner, repo } = parseRepoUrl(config.source.repository);

    // Auth info
    const token = authService.resolveToken(undefined, workspaceRoot);
    let username: string | undefined;
    let permission: string = 'none';

    if (token) {
      try {
        const user = await authService.validateToken(token);
        username = user.username;
        permission = await authService.getRepoPermission(owner, repo, username, token);
      } catch {}
    }

    const knowledgeCount = cachedFiles.filter((f) => f.startsWith('knowledge/')).length;
    const skillsCount = cachedFiles.filter((f) => f.startsWith('skills/') && f.endsWith('.md')).length;

    const data = {
      workspace: workspaceRoot,
      repository: config.source.repository,
      branch: config.source.branch,
      apiUrl: projectConfigManager.getApiUrl(workspaceRoot),
      lastSync: state?.last_sync || null,
      cachedFilesCount: cachedFiles.length,
      knowledgeCount,
      skillsCount,
      authenticatedAs: username || null,
      permission,
      isDirty: dirty.isDirty,
      modifications: {
        modified: dirty.modified,
        added: dirty.added,
        deleted: dirty.deleted,
      },
    };

    outputResult(data, options, () => {
      console.log(pc.bold(pc.cyan('Ever-Brain Workspace Status')));
      console.log(`  Source:       ${pc.white(config.source.repository)} (branch: ${pc.green(config.source.branch)})`);
      console.log(`  API Target:   ${pc.dim(projectConfigManager.getApiUrl(workspaceRoot))}`);
      console.log(`  Last Sync:    ${state?.last_sync ? pc.white(state.last_sync) : pc.yellow('never')}`);
      console.log(`  Cached:       ${cachedFiles.length} files (${knowledgeCount} knowledge, ${skillsCount} skills)`);

      if (username) {
        console.log(`  Auth:         @${username} (Permission: ${permission})`);
      } else {
        console.log(`  Auth:         ${pc.dim('Anonymous (read-only)')}`);
      }

      console.log('');
      if (!dirty.isDirty) {
        console.log(pc.green('  Working tree clean (no unpushed modifications)'));
      } else {
        console.log(pc.yellow('  Local Modifications (Unpushed):'));
        for (const m of dirty.modified) {
          console.log(`    ${pc.yellow('M')} ${m}`);
        }
        for (const a of dirty.added) {
          console.log(`    ${pc.green('A')} ${a}`);
        }
        for (const d of dirty.deleted) {
          console.log(`    ${pc.red('D')} ${d}`);
        }
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'STATUS_ERROR', options);
  }
}
