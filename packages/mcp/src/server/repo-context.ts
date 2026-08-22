export interface RepoContext {
  owner: string;
  repo: string;
}

export function parseRepoContext(
  params?: { owner?: string; repo?: string },
  queryRepo?: string | null
): RepoContext | null {
  // 1. Check path params: :owner/:repo
  if (params?.owner && params?.repo) {
    return {
      owner: decodeURIComponent(params.owner).trim(),
      repo: decodeURIComponent(params.repo).trim(),
    };
  }

  // 2. Check query param: ?repo=https://github.com/owner/repo or ?repo=owner/repo
  if (queryRepo) {
    const trimmed = queryRepo.trim();
    // Match github.com/owner/repo or https://github.com/owner/repo or owner/repo
    const ghMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/\?#]+)/i);
    if (ghMatch) {
      return {
        owner: ghMatch[1],
        repo: ghMatch[2].replace(/\.git$/i, ''),
      };
    }

    const simpleMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (simpleMatch) {
      return {
        owner: simpleMatch[1],
        repo: simpleMatch[2].replace(/\.git$/i, ''),
      };
    }
  }

  return null;
}
