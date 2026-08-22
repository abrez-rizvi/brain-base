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
   # Link the CLI binary so the 'knowiki' command is available globally across all terminals
   pnpm cli:link
   ```
   > **Note:** If this is your first time using global pnpm packages, run `pnpm setup` once to configure your global bin directory in your `PATH`.

---

### 🛠️ Running Services & Verification

```bash
# Start Knowiki API in development mode (http://localhost:3000)
pnpm dev:api

# Start Knowiki MCP Server in development mode (http://localhost:3002)
pnpm dev:mcp

# Run the Knowiki CLI locally within the repository
pnpm knowiki --help

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

## 💡 Trying Knowiki on Any Project on Your PC

You can use Knowiki on **any project or workspace on your computer** without modifying your project's codebase. Here is how to test it end-to-end in 5 minutes:

### 1. Link the CLI globally
From your `knowiki` root folder, run:
```bash
pnpm cli:link
```
*(Runs `pnpm --dir packages/cli link --global`. If you haven't used global pnpm tools before, run `pnpm setup` once).*

### 2. Keep the local API running
Open a terminal in `knowiki` and run the API service:
```bash
pnpm dev:api
```
*(Runs on `http://localhost:3000`)*

### 3. Navigate to any project folder
In a separate terminal, navigate to any repository or codebase on your machine:
```bash
cd C:\path\to\your-other-project
# or: cd ~/projects/my-app
```

### 4. Initialize Knowiki
Connect your project to any GitHub repository containing intelligence, runbooks, or skills:
```bash
knowiki init https://github.com/spencerpauly/skills-repo
```

### 5. What Happens Next
1. **Auto-Bootstrapped Meta-Skill**: Knowiki detects your environment and installs the `knowiki-operator` meta-skill into:
   - **Google Antigravity / Gemini**: `.gemini/skills/knowiki/`
   - **Cursor**: `.cursor/rules/knowiki.mdc`
   - **Claude Code**: `.claude/skills/knowiki/`
2. **Instant Agent Context**: Your AI agent can now autonomously query, read, and search project rules and skills!
3. **Inspect & Materialize**:
   - `knowiki status` — View connected intelligence repository and cache state.
   - `knowiki skills list` — List all available runbooks.
   - `knowiki skills install <skill-name>` — Materialize a skill directly into your agent's skills directory.
4. **Collaborate & Propose Changes**:
   - Edit files in `.knowiki/cache/`
   - `knowiki diff` — Inspect uncommitted local changes.
   - `knowiki push` / `knowiki propose` — Commit directly or open a GitHub Pull Request.

---

## 📄 License
MIT

