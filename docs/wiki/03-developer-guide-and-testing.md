# Wiki: 03. Developer Guide & Testing

This guide outlines how to configure, run, test, and verify the Knowiki codebase.

---

## 1. Monorepo Structure

```text
Knowiki-V1/
├── packages/
│   ├── api/                     # Knowiki API Source Layer (@knowiki/api)
│   │   ├── src/
│   │   │   ├── config.ts        # Environment & runtime config
│   │   │   ├── app.ts           # Hono app instance & route mounts
│   │   │   ├── index.ts         # Node.js server launcher & graceful shutdown
│   │   │   ├── routes/          # Health, Repos, Files, Search routes
│   │   │   ├── services/        # GitHub service, Resolver, TreeCache, Search
│   │   │   ├── types/           # Exportable contract types
│   │   │   └── utils/           # MIME mapper, binary filter, visual logger
│   │   ├── test/                # Vitest unit & integration test suites
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── mcp/                     # Knowiki MCP Adapter (Upcoming)
│   └── cli/                     # Knowiki CLI Plane (Upcoming)
├── docs/
│   └── wiki/                    # Complete Project Wiki Documentation
├── package.json                 # Monorepo root manifest
└── pnpm-workspace.yaml          # pnpm workspace definition
```

---

## 2. Common Workspace Commands

All operations can be run from the root repository directory:

```bash
# Install all dependencies across all packages
pnpm install

# Start the API in watch mode
pnpm dev:api

# Run the test suite across all packages
pnpm test

# Run TypeScript typechecks
pnpm typecheck

# Build all packages for production
pnpm build
```

---

## 3. Automated Test Suite

Automated testing is configured using **Vitest** in [`packages/api/test/`](file:///d:/Knowiki-V1/packages/api/test/):

| Test Suite | File | What is Tested |
| :--- | :--- | :--- |
| **MIME & Filter** | `mime-and-filter.test.ts` | Resolves extensions (`.md`, `.ts`, `.json`, `LICENSE`, `Makefile`), verifies binary/lockfile exclusions. |
| **Tree Cache** | `tree-cache.test.ts` | In-memory keying, TTL expiration, invalidation, and case-insensitivity. |
| **Resolver Service** | `resolver-service.test.ts` | Git tree ingestion, prefix filtering, uppercase case-insensitive resolution, cache hit/miss semantics. |
| **API Route Integration** | `api-routes.test.ts` | `GET /health`, `GET /repos/:owner/:repo`, `GET /repos/:owner/:repo/files`, `GET /repos/:owner/:repo/file/*`, and `/search`. |

To run the tests:
```bash
pnpm --filter @knowiki/api test
```

---

## 4. Live Verification Records

The API has been verified with live HTTP requests against public GitHub repositories:

### Live Test 1: `abrez-rizvi/trial-markdown`
- Target: `https://github.com/abrez-rizvi/trial-markdown` (branch: `main`)
- Discovery Response:
  ```json
  {
    "repository": "abrez-rizvi/trial-markdown",
    "branch": "main",
    "totalFiles": 1,
    "files": [{ "path": "text.md", "type": "file", "sizeBytes": 92, "mimeType": "text/markdown" }]
  }
  ```
- Raw Content Stream (`GET /repos/abrez-rizvi/trial-markdown/file/text.md`):
  - HTTP Status: `200 OK`
  - `Content-Type`: `text/markdown; charset=utf-8`
  - `X-Knowiki-Path`: `text.md`
  - Body: `"sup, say hell yeah gng we in if you could retrieve this information alongisde a few 🤤🤤"`
- Case-Insensitive Normalization (`GET /repos/abrez-rizvi/trial-markdown/file/TEXT.MD`):
  - HTTP Status: `200 OK`
  - `X-Knowiki-Path`: `text.md`
  - Exact raw content returned successfully.

### Live Test 2: `octocat/Hello-World`
- Target: `https://github.com/octocat/Hello-World` (default branch auto-detected: `master`)
- Discovery: Discovered `README` (13 bytes, `text/plain`).
- Content Stream: Retrieved `"Hello World!\n"` with `200 OK`.
- Search (`GET /search?q=Hello`): Returned 1 match with line number location.
