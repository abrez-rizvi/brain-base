import { FileInfo } from '../types/contract.js';

export interface CachedTreeEntry {
  expiresAt: number;
  files: FileInfo[];
  pathMap: Map<string, string>; // lowercase normalized path -> exact case path
}

export class TreeCache {
  private cache = new Map<string, CachedTreeEntry>();

  private makeKey(owner: string, repo: string, branch: string): string {
    return `${owner.toLowerCase()}/${repo.toLowerCase()}:${branch.toLowerCase()}`;
  }

  get(owner: string, repo: string, branch: string): CachedTreeEntry | undefined {
    const key = this.makeKey(owner, repo, branch);
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry;
  }

  set(
    owner: string,
    repo: string,
    branch: string,
    files: FileInfo[],
    pathMap: Map<string, string>,
    ttlMs: number
  ): void {
    const key = this.makeKey(owner, repo, branch);
    this.cache.set(key, {
      expiresAt: Date.now() + ttlMs,
      files,
      pathMap,
    });
  }

  invalidate(owner: string, repo: string, branch: string): void {
    const key = this.makeKey(owner, repo, branch);
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const treeCache = new TreeCache();
