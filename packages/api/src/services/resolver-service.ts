import { config } from '../config.js';
import { FileInfo, FilesResponse } from '../types/contract.js';
import { isBinaryOrIgnoredFile } from '../utils/binary-filter.js';
import { logger } from '../utils/logger.js';
import { resolveMimeType } from '../utils/mime.js';
import { githubService } from './github-service.js';
import { treeCache } from './tree-cache.js';

export interface ResolvedTreeResult extends FilesResponse {
  pathMap: Map<string, string>; // lowercase -> exact path
}

export class ResolverService {
  async getOrDiscoverFiles(
    owner: string,
    repo: string,
    branch?: string,
    fresh = false,
    prefix?: string
  ): Promise<ResolvedTreeResult> {
    const startTime = performance.now();

    // 1. Resolve default branch if not provided
    let targetBranch = branch;
    if (!targetBranch) {
      const meta = await githubService.getRepoMetadata(owner, repo);
      targetBranch = meta.defaultBranch;
    }

    // 2. Check in-memory cache if fresh is false
    if (!fresh) {
      const cached = treeCache.get(owner, repo, targetBranch);
      if (cached) {
        let files = cached.files;
        if (prefix) {
          const normalizedPrefix = prefix.replace(/^\/+/, '');
          files = files.filter((f) => f.path.startsWith(normalizedPrefix));
        }
        return {
          repository: `${owner}/${repo}`,
          branch: targetBranch,
          totalFiles: files.length,
          files,
          pathMap: cached.pathMap,
        };
      }
    }

    // 3. Live discovery from GitHub
    const rawTree = await githubService.getGitTree(owner, repo, targetBranch);
    const pathMap = new Map<string, string>();
    const discoveredFiles: FileInfo[] = [];
    let skippedCount = 0;

    for (const item of rawTree) {
      if (item.type !== 'blob') {
        continue;
      }

      if (isBinaryOrIgnoredFile(item.path)) {
        skippedCount++;
        continue;
      }

      const mimeType = resolveMimeType(item.path);
      const fileInfo: FileInfo = {
        path: item.path,
        type: 'file',
        sizeBytes: item.size || 0,
        mimeType,
      };

      discoveredFiles.push(fileInfo);
      pathMap.set(item.path.toLowerCase(), item.path);
    }

    // 4. Save to cache
    treeCache.set(owner, repo, targetBranch, discoveredFiles, pathMap, config.cacheTtlMs);

    const durationMs = Math.round(performance.now() - startTime);
    logger.tree(discoveredFiles.length, durationMs, skippedCount);

    // 5. Apply prefix filter if requested
    let files = discoveredFiles;
    if (prefix) {
      const normalizedPrefix = prefix.replace(/^\/+/, '');
      files = files.filter((f) => f.path.startsWith(normalizedPrefix));
    }

    return {
      repository: `${owner}/${repo}`,
      branch: targetBranch,
      totalFiles: files.length,
      files,
      pathMap,
    };
  }

  async resolveFilePath(
    owner: string,
    repo: string,
    branch: string,
    requestedPath: string
  ): Promise<{ exactPath: string; branch: string }> {
    const cleanPath = requestedPath.replace(/^\/+/, '');
    const tree = await this.getOrDiscoverFiles(owner, repo, branch, false);

    // Exact or case-insensitive match
    const lowercaseKey = cleanPath.toLowerCase();
    const matchedPath = tree.pathMap.get(lowercaseKey);

    return {
      exactPath: matchedPath || cleanPath,
      branch: tree.branch,
    };
  }
}

export const resolverService = new ResolverService();
