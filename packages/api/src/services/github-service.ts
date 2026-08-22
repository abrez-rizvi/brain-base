import { config } from '../config.js';
import { RepoMetadata } from '../types/contract.js';
import { logger } from '../utils/logger.js';

export interface GitHubGitTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubGitTreeResponse {
  sha: string;
  url: string;
  tree: GitHubGitTreeItem[];
  truncated: boolean;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export class GitHubService {
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'Knowiki-API/1.0',
      Accept: 'application/vnd.github.v3+json',
    };
    if (config.githubToken) {
      headers['Authorization'] = `Bearer ${config.githubToken}`;
    }
    return headers;
  }

  private trackRateLimits(headers: Headers): void {
    const remaining = headers.get('x-ratelimit-remaining');
    const limit = headers.get('x-ratelimit-limit');
    if (remaining && limit) {
      logger.rateLimit(parseInt(remaining, 10), parseInt(limit, 10));
    }
  }

  async getRepoMetadata(owner: string, repo: string): Promise<RepoMetadata> {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const startTime = performance.now();

    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    this.trackRateLimits(response.headers);
    const duration = Math.round(performance.now() - startTime);

    if (response.status === 404) {
      throw new GitHubError(`Repository ${owner}/${repo} not found on GitHub`, 404, 'REPO_NOT_FOUND');
    }

    if (response.status === 403 || response.status === 429) {
      const body = await response.text();
      throw new GitHubError(
        `GitHub API rate limit exceeded or access forbidden: ${body}`,
        response.status,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new GitHubError(
        `GitHub API error (${response.status}): ${body}`,
        response.status,
        'GITHUB_API_ERROR'
      );
    }

    const data = (await response.json()) as {
      default_branch: string;
      description?: string;
      full_name: string;
    };

    logger.target(`${owner}/${repo}`, data.default_branch);
    logger.info('Repo Metadata', `Resolved ${owner}/${repo} in ${duration}ms (Default branch: ${data.default_branch})`);

    return {
      owner,
      repo,
      defaultBranch: data.default_branch || 'main',
      description: data.description || undefined,
    };
  }

  async getGitTree(owner: string, repo: string, branch: string): Promise<GitHubGitTreeItem[]> {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
    const startTime = performance.now();

    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    this.trackRateLimits(response.headers);
    const duration = Math.round(performance.now() - startTime);

    if (response.status === 404) {
      throw new GitHubError(
        `Branch '${branch}' or tree not found for repository ${owner}/${repo}`,
        404,
        'TREE_NOT_FOUND'
      );
    }

    if (response.status === 403 || response.status === 429) {
      const body = await response.text();
      throw new GitHubError(
        `GitHub API rate limit exceeded or access forbidden: ${body}`,
        response.status,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new GitHubError(
        `GitHub API tree discovery error (${response.status}): ${body}`,
        response.status,
        'GITHUB_API_ERROR'
      );
    }

    const data = (await response.json()) as GitHubGitTreeResponse;
    logger.info('Git Tree', `Fetched ${data.tree.length} raw tree items for ${owner}/${repo} (${branch}) in ${duration}ms`);

    return data.tree || [];
  }

  async getRawFileContent(
    owner: string,
    repo: string,
    branch: string,
    filePath: string
  ): Promise<{ status: number; content?: string; sizeBytes: number; durationMs: number }> {
    const cleanPath = filePath.replace(/^\/+/, '');
    const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${cleanPath}`;
    const startTime = performance.now();

    const headers: Record<string, string> = {
      'User-Agent': 'Knowiki-API/1.0',
    };
    if (config.githubToken) {
      headers['Authorization'] = `Bearer ${config.githubToken}`;
    }

    const response = await fetch(url, { headers });
    const durationMs = Math.round(performance.now() - startTime);

    if (response.status === 404) {
      return { status: 404, sizeBytes: 0, durationMs };
    }

    if (!response.ok) {
      return { status: response.status, sizeBytes: 0, durationMs };
    }

    const content = await response.text();
    const sizeBytes = Buffer.byteLength(content, 'utf8');

    logger.raw(`${owner}/${repo}/${branch}/${cleanPath}`, response.status, sizeBytes, durationMs);

    return {
      status: 200,
      content,
      sizeBytes,
      durationMs,
    };
  }
}

export const githubService = new GitHubService();
