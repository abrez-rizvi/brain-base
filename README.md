# Knowiki — Shared Project Intelligence Layer

> **"Git stores what the project IS; Knowiki stores what the project KNOWS."**

Knowiki is a portable, agent-agnostic project intelligence layer that makes repository knowledge, skills, and context discoverable, persistent, and consumable across AI agents and developers.

---

## 🏛️ System Architecture

Knowiki decouples project intelligence from individual AI agents into three modular tiers:

```text
                         GitHub / Raw CDN (Storage & Persistence)
                                           │
                                           ▼
                                 Knowiki API (Source Layer)
                                  ↙                    ↘
                   Knowiki MCP (Agent Layer)       Knowiki CLI (Developer & Agent Plane)
                              ↓                                 ↓
                          AI Agents                   Local Environment / IDE
```

1. **Knowiki API (`packages/api`)** *(Delivered)*: Stateless, read-oriented HTTP source layer. Resolves repositories, discovers text/Markdown files via recursive Git Trees, streams raw content with zero REST API quota overhead, provides in-memory tree caching, and supports plain substring search.
2. **Knowiki MCP (`packages/mcp`)** *(Delivered)*: Agent consumption layer exposing resources (`knowiki://repo/...`) and ReAct tools (`list_files`, `read_file`, `search_files`) over Streamable HTTP (MCP 2025-03-26) and Legacy SSE (MCP 2024-11-05).
3. **Knowiki CLI (`packages/cli`)** *(Delivered)*: Developer and AI agent control plane for local caching, status inspection, skill materialization, auto-bootstrapping agent meta-skills, and GitHub-native Read/Write collaboration (`knowiki push` for maintainers, `knowiki propose` for contributors).

---

## 📚 Project Wiki

Comprehensive documentation is available in the [`docs/wiki/`](./docs/wiki/) directory:

- [**01. Architecture Overview**](./docs/wiki/01-architecture-overview.md) — Core thesis, 3-tier model, design invariants, and scope boundaries.
- [**02. API Specification & Implementation**](./docs/wiki/02-api-specification-and-implementation.md) — Endpoint contracts, GitHub ingestion engine, case-insensitive resolver, 60s tree cache, and search engine.
- [**03. Developer Guide & Testing**](./docs/wiki/03-developer-guide-and-testing.md) — Workspace scripts, test suite execution, live GitHub validation benchmarks, and troubleshooting.
- [**04. MCP Specification & Agent Adapter**](./docs/wiki/04-mcp-specification-and-adapter.md) — Dual transport specs, dual capability declaration, resources & tools mapping, and error ergonomics.
- [**05. CLI Specification & Workflows**](./docs/wiki/05-cli-specification-and-workflows.md) — Pure filesystem cache (`.knowiki/`), agent meta-skill bootstrapping, dirty diffing, and GitHub-native RBAC (`push` / `propose`).
- [**06. Roadmap & Next Steps**](./docs/wiki/06-roadmap-and-next-steps.md) — Supabase cloud deployment, production hardening, and continuous learning roadmap.

---

## 🚀 Getting Started

### 📋 Prerequisites & Downloads

Before installing Knowiki, ensure you have the following downloaded and installed on your machine:

| Software | Required Version | Download / Installation | Verify Command |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` (LTS recommended) | [Download Node.js](https://nodejs.org/) | `node -v` |
| **pnpm** | `>= 9.0.0` | `npm install -g pnpm`<br>*(or `corepack enable && corepack prepare pnpm@latest --activate`)* | `pnpm -v` |
| **Git** | `>= 2.30.0` | [Download Git](https://git-scm.com/downloads) | `git --version` |
| **GitHub Token** *(Optional)* | Classic / Fine-grained PAT | [Generate Token](https://github.com/settings/tokens)<br>*(increases API limit from 60 to 5,000 req/hr)* | — |

---

### 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/abrez-rizvi/knowiki.git
   cd knowiki
   ```

2. **Install monorepo dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure environment variables:**
   ```bash
   # Copy the sample environment file
   cp .env.example .env    # On Windows: copy .env.example .env
   ```
   *(Optional)* Open `.env` and add your `GITHUB_TOKEN` to unlock 5,000 req/hr rate limits.

4. **Build all packages:**
   ```bash
   pnpm build
   ```

5. **(Optional) Install the Knowiki CLI globally:**
   ```bash
   # Link the CLI binary so 'knowiki' command is available anywhere
   pnpm --filter @knowiki/cli link --global
   ```

---

### 🛠️ Running Services & Verification

```bash
# Start Knowiki API in development mode (http://localhost:3000)
pnpm dev:api

# Start Knowiki MCP Server in development mode (http://localhost:3002)
pnpm dev:mcp

# Test the Knowiki CLI locally
pnpm dev:cli -- --help

# Run all 76 automated tests across all 3 packages
pnpm test

# Run TypeScript type check across all packages
pnpm typecheck
```

---

## 💻 CLI Quickstart

```bash
# Connect current workspace to a Knowiki intelligence repository & bootstrap agent meta-skill
knowiki init https://github.com/acme/project-intelligence

# Inspect connection, cached volume, and uncommitted modifications
knowiki status

# Inspect knowledge documents
knowiki knowledge list
knowiki knowledge show architecture.md

# Inspect and materialize skills for local agents
knowiki skills list
knowiki skills show testing
knowiki skills install testing --target gemini # or cursor, claude

# Check diffs and publish changes
knowiki diff
knowiki push -m "feat(skills): add database migration runbook" # Direct commit for maintainers
knowiki propose --title "feat: Add Webhook runbook"           # Opens GitHub PR for contributors
```

---

## 📄 License
MIT
