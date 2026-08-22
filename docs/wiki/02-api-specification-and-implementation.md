# Wiki: 02. API Specification & Implementation

The **Knowiki API** is the content-access layer built on **TypeScript + Hono (Node.js)**. It serves as a dumb, reliable source layer that resolves GitHub repositories and streams their content.

---

## 1. Dual Ingestion Strategy

To balance fast response times with strict GitHub API rate-limit conservation, the API utilizes a two-tier ingestion mechanism:

```text
               ┌────────────────────────────────────────────────┐
               │                  Knowiki API                   │
               └────────┬──────────────────────────────┬────────┘
                        │                              │
             1. Tree Discovery               2. Content Streaming
             (api.github.com)             (raw.githubusercontent.com)
                        │                              │
                        ▼                              ▼
             GitHub Git Trees API               Raw GitHub CDN
         (1 req / 60s cached per repo)           (0 REST API quota cost)
```

1. **Discovery Tier**:
   - Discovers project trees via `GET https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1`.
   - Single HTTP request discovers entire repository hierarchies (up to 100,000 objects in 45–380ms).
   - Rate limit tracked via response headers (`x-ratelimit-remaining`, `x-ratelimit-limit`).
2. **Streaming Tier**:
   - Streams raw file contents directly from `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`.
   - **Consumes 0 GitHub REST API quota**, allowing unlimited content reads for public repositories.

---

## 2. In-Memory Tree Cache Engine

- **Implementation**: [`packages/api/src/services/tree-cache.ts`](file:///d:/Knowiki-V1/packages/api/src/services/tree-cache.ts)
- **TTL**: 60,000ms (60 seconds) by default (configurable via `CACHE_TTL_MS`).
- **Key**: `${owner.toLowerCase()}/${repo.toLowerCase()}:${branch.toLowerCase()}`.
- **Cache Invalidation**:
  - Automatically expires after TTL.
  - Can be bypassed on any request by passing query parameter `?fresh=true`.
  - In-memory only: Server restarts cleanly drop cache with zero data loss or corruption.

---

## 3. Path Normalization & Binary Filtering

### Case-Insensitive Path Normalization
Many autonomous AI agents request uppercase filenames (e.g. `README.md`, `INDEX.md`, `LICENSE.txt`) even when the repository uses lowercase (`readme.md`).
- The API builds a lowercase lookup index during tree discovery:
  `pathMap: Map<lowercasePath, exactCasedPath>`.
- When an endpoint receives `/repos/acme/project/file/README.md`, the resolver looks up `readme.md`, discovers the true casing, and streams the correct raw CDN file without raising a 404.

### Binary and Noise Filter
The API excludes non-textual files and `.git/` repository internals during discovery:
- **Git internals**: `.git/`, `.git/HEAD`, `.git/objects/...`
- **Images**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.ico`, `.webp`, `.bmp`, `.tiff`, `.svg`
- **Audio/Video**: `.mp3`, `.mp4`, `.wav`, `.mov`, `.avi`, `.flac`, `.mkv`, etc.
- **Binaries & Archives**: `.zip`, `.tar`, `.gz`, `.7z`, `.rar`, `.exe`, `.dll`, `.so`, `.wasm`, `.bin`
- **Lockfiles & DBs**: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `Cargo.lock`, `.sqlite`, `.db`

*(Note: The API does not enforce arbitrary framework ignore lists like `node_modules` or `dist` to avoid restricting genuine content repositories).*

---

## 4. Substring Search Engine

- **Implementation**: [`packages/api/src/services/search-service.ts`](file:///d:/Knowiki-V1/packages/api/src/services/search-service.ts)
- **Design**: Dumb, exact substring matching across discovered text/Markdown files.
- **Concurrency**: Streams candidate files concurrently in controlled batches of 10.
- **Response**: Returns matching file paths, total match count, and 1-indexed line numbers where the query occurs.

---

## 5. Complete REST API Reference

### `GET /health`
Operational probe returning service status, uptime, and timestamp.
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptimeSeconds": 142,
  "timestamp": "2026-08-21T14:36:28.656Z"
}
```

### `GET /repos/:owner/:repo`
Resolves repository metadata and detects the default branch (`main`, `master`, `develop`, etc.).
```json
{
  "owner": "abrez-rizvi",
  "repo": "trial-markdown",
  "defaultBranch": "main"
}
```

### `GET /repos/:owner/:repo/files`
Returns flat array of discovered project files.
- **Query Parameters**:
  - `prefix` *(optional)*: Filter by path prefix (e.g. `?prefix=knowledge/`).
  - `fresh` *(optional)*: Pass `true` or `1` to bypass the 60s in-memory tree cache.
  - `branch` *(optional)*: Target a specific branch instead of the default branch.
```json
{
  "repository": "abrez-rizvi/trial-markdown",
  "branch": "main",
  "totalFiles": 1,
  "files": [
    {
      "path": "text.md",
      "type": "file",
      "sizeBytes": 92,
      "mimeType": "text/markdown"
    }
  ]
}
```

### `GET /repos/:owner/:repo/file/*path`
Streams the exact raw text or Markdown content with appropriate headers.
- **Response Headers**:
  - `Content-Type`: MIME type (e.g. `text/markdown; charset=utf-8`, `text/plain; charset=utf-8`).
  - `X-Knowiki-Path`: Exact cased path in the repository.
  - `X-Knowiki-Branch`: Target branch resolved.
- **Aliases**: `GET /repos/:owner/:repo/files/*path` and `GET /projects/:owner/:repo/files/*path`.

### `GET /repos/:owner/:repo/search`
Searches text/Markdown documents for a string query.
- **Query Parameters**:
  - `q` *(required)*: The search string.
  - `prefix` *(optional)*: Search only within a specific folder prefix.
  - `branch` *(optional)*: Target branch.
```json
{
  "query": "architecture",
  "totalMatches": 3,
  "results": [
    {
      "path": "knowledge/architecture.md",
      "matches": 3,
      "lines": [1, 14, 42]
    }
  ]
}
```
