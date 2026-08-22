# Wiki: 03. Developer Guide & Testing

This guide outlines how to configure, run, test, and verify the Ever-Brain codebase.

---

## 1. Prerequisites & Required Downloads

Before developing or running Ever-Brain locally, ensure the following tools are installed:

| Software | Required Version | Official Download / Install | Version Check |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` (LTS recommended) | [nodejs.org](https://nodejs.org/) | `node -v` |
| **pnpm** | `>= 9.0.0` | `npm install -g pnpm`<br>*(or `corepack enable && corepack prepare pnpm@latest --activate`)* | `pnpm -v` |
| **Git** | `>= 2.30.0` | [git-scm.com](https://git-scm.com/downloads) | `git --version` |
| **GitHub Token** *(Optional)* | Classic / Fine-grained PAT | [GitHub Tokens](https://github.com/settings/tokens)<br>*(increases API limit from 60 to 5,000 req/hr)* | — |

---

## 2. Monorepo Structure

```text
ever-brain/
├── packages/
│   ├── api/                     # Ever-Brain API Source Layer (@ever-brain/api)
│   │   ├── src/                 # Hono app, Git tree resolver, cache, routes
│   │   ├── test/                # API integration & unit tests
│   │   └── package.json
│   ├── mcp/                     # Ever-Brain MCP Adapter (@ever-brain/mcp)
│   │   ├── src/                 # Streamable HTTP (2025-03-26) & SSE (2024-11-05)
│   │   ├── test/                # MCP protocol integration tests
│   │   └── package.json
│   └── cli/                     # Ever-Brain CLI Control Plane (@ever-brain/cli)
│       ├── src/                 # Meta-skill bootstrap, cache, diff, push/propose
│       ├── test/                # CLI command & cache tests
│       └── package.json
├── docs/
│   └── wiki/                    # Complete 6-Part Project Wiki Documentation
├── .env.example                 # Sample environment configuration template
├── package.json                 # Monorepo root manifest
└── pnpm-workspace.yaml          # pnpm workspace definition
```

---

## 3. Setup & Workspace Commands

```bash
# 1. Install dependencies across all packages
pnpm install

# 2. Configure environment variables
cp .env.example .env             # Windows: copy .env.example .env

# 3. Build all TypeScript packages
pnpm build

# 4. Start local services (API + MCP Concurrently)
pnpm dev                         # Hosts API on :3000 and MCP on :3002

# Or start services individually:
# pnpm dev:api                   # Start API only
# pnpm dev:mcp                   # Start MCP server only

# 5. Run CLI directly in workspace
pnpm evb --help

# 6. Link CLI globally across your machine (optional)
pnpm cli:link                    # Makes 'evb' available in all terminals

# 7. Run test suite across all 3 packages
pnpm test

# 8. Typecheck all packages
pnpm typecheck
```

---

## 4. Automated Test Suites

Automated testing is configured using **Vitest** across all packages:

| Package | Test Suite Files | What is Tested |
| :--- | :--- | :--- |
| **`@ever-brain/api`** | `mime-and-filter.test.ts`<br>`tree-cache.test.ts`<br>`resolver-service.test.ts`<br>`api-routes.test.ts` | Resolves extensions, exclusions, in-memory TTL caching, Git tree ingestion, and HTTP endpoints (`/health`, `/repos`, `/files`, `/file/*`, `/search`). |
| **`@ever-brain/mcp`** | `mcp-server-factory.test.ts`<br>`repo-context.test.ts`<br>`mcp-routes.test.ts`<br>`mcp-integration-e2e.test.ts` | Streamable HTTP & SSE transport endpoints, MCP resources (`ever-brain://repo/...`), and tools (`list_files`, `read_file`, `search_files`). |
| **`@ever-brain/cli`** | `project-config.test.ts`<br>`cache-and-dirty-state.test.ts`<br>`meta-skill-service.test.ts`<br>`materialize-service.test.ts`<br>`auth-service.test.ts`<br>`github-writer-service.test.ts`<br>`cli-commands.test.ts` | Pure filesystem cache (`.evb/`), config validation, dirty diff tracking, meta-skill generation for Antigravity/Cursor/Claude, and push/propose commands. |

---

## 5. Live Verification Records

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
  - `X-Ever-Brain-Path`: `text.md`
  - Body: `"sup, say hell yeah gng we in if you could retrieve this information alongisde a few 🤤🤤"`
- Case-Insensitive Normalization (`GET /repos/abrez-rizvi/trial-markdown/file/TEXT.MD`):
  - HTTP Status: `200 OK`
  - `X-Ever-Brain-Path`: `text.md`
  - Exact raw content returned successfully.

### Live Test 2: `octocat/Hello-World`
- Target: `https://github.com/octocat/Hello-World` (default branch auto-detected: `master`)
- Discovery: Discovered `README` (13 bytes, `text/plain`).
- Content Stream: Retrieved `"Hello World!\n"` with `200 OK`.
- Search (`GET /search?q=Hello`): Returned 1 match with line number location.
