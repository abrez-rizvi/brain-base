import { RepoMetadata, FilesResponse, SearchResponse } from '@knowiki/api/contract';

export class CliApiClient {
  constructor(private baseUrl: string) {}

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  private cleanUrl(endpoint: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}${endpoint}`;
  }

  private async safeFetch(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Cannot connect to Knowiki API at ${this.baseUrl} (${errorMsg}).\n` +
        `Is the Knowiki server running? Start it with 'pnpm dev' (or configure --api-url / KNOWIKI_API_URL).`
      );
    }
  }

  async getRepoMetadata(owner: string, repo: string): Promise<RepoMetadata> {
    const url = this.cleanUrl(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    const res = await this.safeFetch(url, {
      headers: { 'User-Agent': 'Knowiki-CLI/1.0', Accept: 'application/json' },
    });

    if (!res.ok) {
      let message = `Failed to resolve repository ${owner}/${repo} (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {}
      throw new Error(message);
    }

    return (await res.json()) as RepoMetadata;
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
    const url = this.cleanUrl(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/files${queryString}`
    );

    const res = await this.safeFetch(url, {
      headers: { 'User-Agent': 'Knowiki-CLI/1.0', Accept: 'application/json' },
    });

    if (!res.ok) {
      let message = `Failed to fetch files for ${owner}/${repo} (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {}
      throw new Error(message);
    }

    return (await res.json()) as FilesResponse;
  }

  async getFileContent(
    owner: string,
    repo: string,
    filePath: string,
    branch?: string
  ): Promise<{ content: string; exactPath: string; branch: string }> {
    const cleanPath = filePath.replace(/^\/+/, '');
    const params = new URLSearchParams();
    if (branch) params.set('branch', branch);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const url = this.cleanUrl(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/file/${cleanPath}${queryString}`
    );

    const res = await this.safeFetch(url, {
      headers: { 'User-Agent': 'Knowiki-CLI/1.0' },
    });

    if (!res.ok) {
      let message = `File '${cleanPath}' not found in ${owner}/${repo}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {}
      throw new Error(message);
    }

    const content = await res.text();
    const exactPath = res.headers.get('x-knowiki-path') || cleanPath;
    const resolvedBranch = res.headers.get('x-knowiki-branch') || branch || 'main';

    return {
      content,
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

    const url = this.cleanUrl(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/search?${params.toString()}`
    );

    const res = await this.safeFetch(url, {
      headers: { 'User-Agent': 'Knowiki-CLI/1.0', Accept: 'application/json' },
    });

    if (!res.ok) {
      let message = `Search failed for ${owner}/${repo} (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {}
      throw new Error(message);
    }

    return (await res.json()) as SearchResponse;
  }
}
