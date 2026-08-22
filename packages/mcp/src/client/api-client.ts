import { config } from '../config.js';
import type {
  FilesResponse,
  RepoMetadata,
  SearchResponse,
} from '@ever-brain/api/contract';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export class ApiClient {
  constructor(private baseUrl = config.apiUrl) {}

  private async fetchJson<T>(path: string): Promise<T> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}${path}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Ever-Brain-MCP/1.0',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      let errorMessage = `API error (${res.status})`;
      let errorCode = 'API_ERROR';
      try {
        const errorBody = (await res.json()) as { error?: string; code?: string };
        if (errorBody.error) errorMessage = errorBody.error;
        if (errorBody.code) errorCode = errorBody.code;
      } catch {
        // use fallback text
      }
      throw new ApiClientError(errorMessage, res.status, errorCode);
    }

    return (await res.json()) as T;
  }

  async getRepoMetadata(owner: string, repo: string): Promise<RepoMetadata> {
    return this.fetchJson<RepoMetadata>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    );
  }

  async getFiles(
    owner: string,
    repo: string,
    prefix?: string,
    fresh?: boolean,
    branch?: string
  ): Promise<FilesResponse> {
    const params = new URLSearchParams();
    if (prefix) params.set('prefix', prefix);
    if (fresh) params.set('fresh', 'true');
    if (branch) params.set('branch', branch);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.fetchJson<FilesResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/files${queryString}`
    );
  }

  async getFileContent(
    owner: string,
    repo: string,
    filePath: string,
    branch?: string
  ): Promise<{ content: string; mimeType: string; exactPath: string; branch: string }> {
    const cleanPath = filePath.replace(/^\/+/, '');
    const params = new URLSearchParams();
    if (branch) params.set('branch', branch);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const url = `${this.baseUrl.replace(/\/+$/, '')}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/file/${cleanPath}${queryString}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Ever-Brain-MCP/1.0',
      },
    });

    if (!res.ok) {
      let errorMessage = `File '${cleanPath}' not found in repository ${owner}/${repo}`;
      let errorCode = 'FILE_NOT_FOUND';
      try {
        const errorBody = (await res.json()) as { error?: string; code?: string };
        if (errorBody.error) errorMessage = errorBody.error;
        if (errorBody.code) errorCode = errorBody.code;
      } catch {
        // fallback
      }
      throw new ApiClientError(errorMessage, res.status, errorCode);
    }

    const content = await res.text();
    const mimeType = res.headers.get('content-type') || 'text/plain';
    const exactPath = res.headers.get('x-ever-brain-path') || cleanPath;
    const resolvedBranch = res.headers.get('x-ever-brain-branch') || branch || 'main';

    return {
      content,
      mimeType,
      exactPath,
      branch: resolvedBranch,
    };
  }

  async searchFiles(
    owner: string,
    repo: string,
    query: string,
    prefix?: string,
    branch?: string
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (prefix) params.set('prefix', prefix);
    if (branch) params.set('branch', branch);

    return this.fetchJson<SearchResponse>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/search?${params.toString()}`
    );
  }
}

export const apiClient = new ApiClient();
