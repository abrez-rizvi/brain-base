import { projectConfigManager } from '../config/project-config.js';
import { cacheService, computeSha256 } from './cache-service.js';
import { CliApiClient } from '../client/api-client.js';

export interface SyncResult {
  updated: number;
  unchanged: number;
  removed: number;
  total: number;
  dirtySkipped?: boolean;
}

export function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  const clean = repoUrl.trim();
  const ghMatch = clean.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/\?#]+)/i);
  if (ghMatch) {
    return {
      owner: ghMatch[1],
      repo: ghMatch[2].replace(/\.git$/i, ''),
    };
  }

  const parts = clean.split('/');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/i, ''),
    };
  }

  throw new Error(`Invalid GitHub repository format '${repoUrl}'. Expected 'owner/repo' or 'https://github.com/owner/repo'`);
}

export class SyncService {
  async sync(
    workspaceRoot: string,
    options?: { force?: boolean; client?: CliApiClient }
  ): Promise<SyncResult> {
    const config = projectConfigManager.readConfig(workspaceRoot);
    const { owner, repo } = parseRepoUrl(config.source.repository);
    const targetBranch = config.source.branch || 'main';

    // 1. Dirty state collision guard
    const dirty = cacheService.computeDirtyState(workspaceRoot);
    if (dirty.isDirty && !options?.force) {
      const allDirty = [...dirty.modified, ...dirty.added, ...dirty.deleted];
      throw new Error(
        `You have uncommitted local modifications in:\n` +
          allDirty.map((f) => `  • ${f}`).join('\n') +
          `\n\nSync halted to prevent accidental overwrite. Use 'evb push' / 'evb propose' to publish, or 'evb sync --force' to overwrite.`
      );
    }

    const apiUrl = projectConfigManager.getApiUrl(workspaceRoot);
    const client = options?.client || new CliApiClient(apiUrl);

    // 2. Fetch remote tree
    const treeResponse = await client.getFiles(owner, repo, undefined, true, targetBranch);
    const remoteFiles = treeResponse.files;

    const oldState = projectConfigManager.readState(workspaceRoot);
    const oldBaseline = oldState?.files || {};

    let updated = 0;
    let unchanged = 0;
    const newFileHashes: Record<string, string> = {};
    const remotePathSet = new Set<string>();

    // 3. Sync files
    for (const remoteFile of remoteFiles) {
      remotePathSet.add(remoteFile.path);

      const fileContentRes = await client.getFileContent(
        owner,
        repo,
        remoteFile.path,
        targetBranch
      );

      const content = fileContentRes.content;
      const sha256 = computeSha256(content);
      newFileHashes[remoteFile.path] = sha256;

      const currentLocalContent = cacheService.readCachedFile(workspaceRoot, remoteFile.path);
      if (currentLocalContent === content) {
        unchanged++;
      } else {
        cacheService.writeCachedFile(workspaceRoot, remoteFile.path, content);
        updated++;
      }
    }

    // 4. Remove deleted remote files from cache
    let removed = 0;
    const localCachedFiles = cacheService.listCachedFiles(workspaceRoot);
    for (const localFile of localCachedFiles) {
      if (!remotePathSet.has(localFile)) {
        cacheService.deleteCachedFile(workspaceRoot, localFile);
        removed++;
      }
    }

    // 5. Update state.yaml
    projectConfigManager.writeState(workspaceRoot, {
      last_sync: new Date().toISOString(),
      source_revision: targetBranch,
      cached_files: remoteFiles.length,
      files: newFileHashes,
    });

    return {
      updated,
      unchanged,
      removed,
      total: remoteFiles.length,
    };
  }
}

export const syncService = new SyncService();
