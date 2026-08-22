import { Hono } from 'hono';
import { githubService, GitHubError } from '../services/github-service.js';
import { resolverService } from '../services/resolver-service.js';
import { searchService } from '../services/search-service.js';
import { resolveMimeType } from '../utils/mime.js';

export const reposRouter = new Hono();

// GET /repos/:owner/:repo — Repo metadata & default branch
reposRouter.get('/:owner/:repo', async (c) => {
  const { owner, repo } = c.req.param();
  try {
    const meta = await githubService.getRepoMetadata(owner, repo);
    return c.json(meta);
  } catch (err: unknown) {
    if (err instanceof GitHubError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});

// GET /repos/:owner/:repo/files — Discovered files in repo
reposRouter.get('/:owner/:repo/files', async (c) => {
  const { owner, repo } = c.req.param();
  const prefix = c.req.query('prefix');
  const fresh = c.req.query('fresh') === 'true' || c.req.query('fresh') === '1';
  const branch = c.req.query('branch');

  try {
    const result = await resolverService.getOrDiscoverFiles(owner, repo, branch, fresh, prefix);
    return c.json({
      repository: result.repository,
      branch: result.branch,
      totalFiles: result.totalFiles,
      files: result.files,
    });
  } catch (err: unknown) {
    if (err instanceof GitHubError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});

// GET /repos/:owner/:repo/search — Substring search across repo files
reposRouter.get('/:owner/:repo/search', async (c) => {
  const { owner, repo } = c.req.param();
  const q = c.req.query('q');
  const prefix = c.req.query('prefix');
  const branch = c.req.query('branch');

  if (!q || !q.trim()) {
    return c.json({ error: "Query parameter 'q' is required", code: 'MISSING_QUERY' }, 400);
  }

  try {
    const result = await searchService.search(owner, repo, q, branch, prefix);
    return c.json(result);
  } catch (err: unknown) {
    if (err instanceof GitHubError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});

// GET /repos/:owner/:repo/file/* — Raw file content retrieval
reposRouter.get('/:owner/:repo/file/*', async (c) => {
  const { owner, repo } = c.req.param();
  // Extract wildcard path
  const rawPath = c.req.path.replace(`/repos/${owner}/${repo}/file/`, '');
  const branchParam = c.req.query('branch');

  try {
    let targetBranch = branchParam;
    if (!targetBranch) {
      const meta = await githubService.getRepoMetadata(owner, repo);
      targetBranch = meta.defaultBranch;
    }

    const { exactPath, branch } = await resolverService.resolveFilePath(
      owner,
      repo,
      targetBranch,
      rawPath
    );

    const fileRes = await githubService.getRawFileContent(owner, repo, branch, exactPath);

    if (fileRes.status === 404 || fileRes.content === undefined) {
      return c.json(
        {
          error: `File '${rawPath}' not found in repository ${owner}/${repo} (${branch})`,
          code: 'FILE_NOT_FOUND',
        },
        404
      );
    }

    const mimeType = resolveMimeType(exactPath);
    return c.text(fileRes.content, 200, {
      'Content-Type': `${mimeType}; charset=utf-8`,
      'X-Ever-Brain-Path': exactPath,
      'X-Ever-Brain-Branch': branch,
    });
  } catch (err: unknown) {
    if (err instanceof GitHubError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});

// Alias for /repos/:owner/:repo/files/* (some clients use files/path)
reposRouter.get('/:owner/:repo/files/*', async (c) => {
  const { owner, repo } = c.req.param();
  const rawPath = c.req.path.replace(`/repos/${owner}/${repo}/files/`, '');
  const branchParam = c.req.query('branch');

  try {
    let targetBranch = branchParam;
    if (!targetBranch) {
      const meta = await githubService.getRepoMetadata(owner, repo);
      targetBranch = meta.defaultBranch;
    }

    const { exactPath, branch } = await resolverService.resolveFilePath(
      owner,
      repo,
      targetBranch,
      rawPath
    );

    const fileRes = await githubService.getRawFileContent(owner, repo, branch, exactPath);

    if (fileRes.status === 404 || fileRes.content === undefined) {
      return c.json(
        {
          error: `File '${rawPath}' not found in repository ${owner}/${repo} (${branch})`,
          code: 'FILE_NOT_FOUND',
        },
        404
      );
    }

    const mimeType = resolveMimeType(exactPath);
    return c.text(fileRes.content, 200, {
      'Content-Type': `${mimeType}; charset=utf-8`,
      'X-Ever-Brain-Path': exactPath,
      'X-Ever-Brain-Branch': branch,
    });
  } catch (err: unknown) {
    if (err instanceof GitHubError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message, code: 'INTERNAL_ERROR' }, 500);
  }
});
