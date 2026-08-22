export function formatTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `[${hours}:${minutes}:${seconds}]`;
}

export const logger = {
  info(tag: string, message: string): void {
    console.log(`${formatTimestamp()} ℹ️ [${tag}] ${message}`);
  },

  success(tag: string, message: string): void {
    console.log(`${formatTimestamp()} ✅ [${tag}] ${message}`);
  },

  target(repo: string, branch: string): void {
    console.log(`${formatTimestamp()} 🎯 [Target] Parsed repo: ${repo} (Branch: ${branch})`);
  },

  tree(fileCount: number, durationMs: number, skippedCount = 0): void {
    console.log(
      `${formatTimestamp()} 🌳 [Tree Discovery] ${fileCount} files discovered in ${durationMs}ms (${skippedCount} ignored/binary skipped)`
    );
  },

  raw(path: string, status: number, sizeBytes: number, durationMs: number): void {
    const sizeKb = (sizeBytes / 1024).toFixed(1);
    console.log(
      `${formatTimestamp()} 📖 [Raw Stream] ${path} -> ${status} OK (${sizeKb} KB, ${durationMs}ms)`
    );
  },

  search(query: string, matchesCount: number, durationMs: number): void {
    console.log(
      `${formatTimestamp()} 🔍 [Search] Query '${query}' -> ${matchesCount} matches in ${durationMs}ms`
    );
  },

  rateLimit(remaining: number, limit: number): void {
    const level = remaining < 10 ? '⚠️' : '📊';
    console.log(`${formatTimestamp()} ${level} [GitHub API] Rate limit remaining: ${remaining}/${limit}`);
  },

  warn(tag: string, message: string): void {
    console.warn(`${formatTimestamp()} ⚠️ [${tag}] ${message}`);
  },

  error(tag: string, message: string, error?: unknown): void {
    console.error(`${formatTimestamp()} ❌ [${tag}] ${message}`, error ? error : '');
  },
};
