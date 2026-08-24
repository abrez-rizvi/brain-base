---
title: Ever-Brain MCP & Intelligence Gateway
emoji: 🧠
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 7860
---

# Ever-Brain — Shared Project Intelligence Layer

> **"Git stores what the project IS; Ever-Brain stores what the project KNOWS."**

Ever-Brain is a portable, agent-agnostic project intelligence layer that makes repository knowledge, skills, and context discoverable, persistent, and consumable across AI agents and developers.

🌐 **Deployed Landing Page**: [https://ever-brain.vercel.app/](https://ever-brain.vercel.app/)  
🤗 **Hosted Backend (Hugging Face)**: [https://projectsorg-ever-brain.hf.space/](https://projectsorg-ever-brain.hf.space/)  
📦 **Releases & Deployment**: [https://github.com/abrez-rizvi/ever-brain/releases](https://github.com/abrez-rizvi/ever-brain/releases)

---

## ⚡ Quick Start (Run in 60 Seconds)

Clone and host both the **Ever-Brain API** and **Ever-Brain MCP Server** concurrently with a single command:

```bash
# 1. Clone & Enter
git clone https://github.com/abrez-rizvi/ever-brain.git
cd ever-brain

# 2. Install Dependencies
pnpm install

# 3. Start Local Servers (API + MCP Concurrently)
pnpm dev
```

That's it! Both servers are now live (or use the hosted backend on Hugging Face):
* 🤗 **Hosted Backend Gateway**: `https://projectsorg-ever-brain.hf.space/` *(Health: `/health`, UI: `/ui`, SSE: `/sse`)*
* 🟢 **Local Ever-Brain API**: `http://localhost:3000` *(Health check: `http://localhost:3000/health`)*
* 🟣 **Local Ever-Brain MCP Server**: `http://localhost:3002` *(SSE endpoint: `http://localhost:3002/sse`)*

### 🎮 Using the CLI Immediately
```bash
# Run CLI directly inside the repo:
pnpm evb --help

# Or link it globally to use 'evb' anywhere on your PC:
pnpm cli:link
```

---

## 🏛️ System Architecture

Ever-Brain decouples project intelligence from individual AI agents into three modular tiers:

```text
                         GitHub / Raw CDN (Storage & Persistence)
                                           │
                                           ▼
                                 Ever-Brain API (Source Layer)
                                  ↙                    ↘
                   Ever-Brain MCP (Agent Layer)       Ever-Brain CLI (Developer & Agent Plane)
                              ↓                                 ↓
                          AI Agents                   Local Environment / IDE
```

1. **Ever-Brain API (`packages/api`)** *(Delivered)*: Stateless, read-oriented HTTP source layer. Resolves repositories, discovers text/Markdown files via recursive Git Trees, streams raw content with zero REST API quota overhead, provides in-memory tree caching, and supports plain substring search.
2. **Ever-Brain MCP (`packages/mcp`)** *(Delivered)*: Agent consumption layer exposing resources (`ever-brain://repo/...`) and ReAct tools (`list_files`, `read_file`, `search_files`) over Streamable HTTP (MCP 2025-03-26) and Legacy SSE (MCP 2024-11-05).
3. **Ever-Brain CLI (`packages/cli`)** *(Delivered)*: Developer and AI agent control plane for local caching, status inspection, skill materialization, auto-bootstrapping agent meta-skills, and GitHub-native Read/Write collaboration (`evb push` for maintainers, `evb propose` for contributors).

---

## 📚 Project Wiki

Comprehensive documentation is available in the [`docs/wiki/`](./docs/wiki/) directory:

- [**01. Architecture Overview**](./docs/wiki/01-architecture-overview.md) — Core thesis, 3-tier model, design invariants, and scope boundaries.
- [**02. API Specification & Implementation**](./docs/wiki/02-api-specification-and-implementation.md) — Endpoint contracts, GitHub ingestion engine, case-insensitive resolver, 60s tree cache, and search engine.
- [**03. Developer Guide & Testing**](./docs/wiki/03-developer-guide-and-testing.md) — Workspace scripts, test suite execution, live GitHub validation benchmarks, and troubleshooting.
- [**04. MCP Specification & Agent Adapter**](./docs/wiki/04-mcp-specification-and-adapter.md) — Dual transport specs, dual capability declaration, resources & tools mapping, and error ergonomics.
- [**05. CLI Specification & Workflows**](./docs/wiki/05-cli-specification-and-workflows.md) — Pure filesystem cache (`.evb/`), agent meta-skill bootstrapping, dirty diffing, and GitHub-native RBAC (`push` / `propose`).
- [**06. Roadmap & Next Steps**](./docs/wiki/06-roadmap-and-next-steps.md) — Supabase cloud deployment, production hardening, and continuous learning roadmap.
- [**07. Visualizer & Robust Edge-Case Handling**](./docs/wiki/07-visualizer-and-edge-case-handling.md) — Real-time reactive web cockpit, dual-transport resilience, binary guards, and broken reference detection.

---

## 💡 Trying Ever-Brain on Any Project on Your PC

You can use Ever-Brain on **any project or workspace on your computer** without modifying your project's codebase. Here is how to test it end-to-end in 5 minutes:

### 1. Link the CLI globally
From your `ever-brain` root folder, run:
```bash
pnpm cli:link
```
*(Runs `pnpm --dir packages/cli link --global`. If you haven't used global pnpm tools before, run `pnpm setup` once).*

### 2. Keep the local servers running
In a terminal in `ever-brain`, start the servers:
```bash
pnpm dev
```
*(Hosts API on `:3000` and MCP on `:3002`)*

### 3. Navigate to any project folder
In a separate terminal, navigate to any repository or codebase on your machine:
```bash
cd C:\path\to\your-other-project
# or: cd ~/projects/my-app
```

### 4. Initialize Ever-Brain
Connect your project to any GitHub repository containing intelligence, runbooks, or skills:
```bash
evb init https://github.com/Dhruv-Pahwa/byteme_sample
```

### 5. What Happens Next
1. **Auto-Bootstrapped Meta-Skill**: Ever-Brain detects your environment and installs the `ever-brain` meta-skill into:
   - **Google Antigravity / Gemini**: `.gemini/skills/ever-brain/`
   - **Cursor**: `.cursor/rules/ever-brain.mdc`
   - **Claude Code**: `.claude/skills/ever-brain/`
2. **Instant Agent Context**: Your AI agent can now autonomously query, read, and search project rules and skills!
3. **Inspect & Materialize**:
   - `evb status` — View connected intelligence repository and cache state.
   - `evb skills list` — List all available runbooks.
   - `evb skills install <skill-name>` — Materialize a skill directly into your agent's skills directory.
4. **Collaborate & Propose Changes**:
   - Edit files in `.evb/cache/`
   - `evb diff` — Inspect uncommitted local changes.
   - `evb push` / `evb propose` — Commit directly or open a GitHub Pull Request.

---

## 🛠️ Advanced Development & Verification

### 📋 Prerequisites & Downloads

| Software / Resource | Required Version | Download / Installation / Link | Verify Command |
| :--- | :--- | :--- | :--- |
| **Live Landing Page** | Deployed Web App | [ever-brain.vercel.app](https://ever-brain.vercel.app/) | — |
| **Hosted Backend Gateway** | Hugging Face Spaces | [projectsorg-ever-brain.hf.space](https://projectsorg-ever-brain.hf.space/) | — |
| **GitHub Releases** | Latest Release & Assets | [Releases Page](https://github.com/abrez-rizvi/ever-brain/releases) | — |
| **Node.js** | `>= 20.0.0` (LTS recommended) | [Download Node.js](https://nodejs.org/) | `node -v` |
| **pnpm** | `>= 9.0.0` | `npm install -g pnpm`<br>*(or `corepack enable && corepack prepare pnpm@latest --activate`)* | `pnpm -v` |
| **Git** | `>= 2.30.0` | [Download Git](https://git-scm.com/downloads) | `git --version` |
| **GitHub Token** *(Optional)* | Classic / Fine-grained PAT | [Generate Token](https://github.com/settings/tokens)<br>*(increases API limit from 60 to 5,000 req/hr)* | — |

### 🧪 Workspace Commands & Tests

```bash
# Start both API and MCP servers concurrently
pnpm dev

# Start individual services in development mode
pnpm dev:api                     # API on port 3000
pnpm dev:mcp                     # MCP server on port 3002

# Run all automated tests across all 3 packages
pnpm test

# Run TypeScript type check across all packages
pnpm typecheck

# Build all packages for production
pnpm build
```

---

## 💻 CLI Quickstart

```bash
# Connect current workspace to an Ever-Brain intelligence repository & bootstrap agent meta-skill
evb init https://github.com/Dhruv-Pahwa/byteme_sample

# Inspect connection, cached volume, and uncommitted modifications
evb status

# Inspect knowledge documents
evb knowledge list
evb knowledge show espresso-fundamentals.md

# Inspect and materialize skills for local agents
evb skills list
evb skills show french-press-brewing
evb skills install french-press-brewing --target gemini # or cursor, claude

# Open the live, reactive Ever-Brain Intelligence Visualizer in your browser
evb ui

# Check diffs with robust binary asset protection & CRLF line-ending normalization
evb diff
evb push -m "feat(skills): add aeropress brewing runbook"   # Direct commit for maintainers
evb propose --title "feat: Add AeroPress brewing runbook" # Opens GitHub PR for contributors
```

---

## 🗺️ Live Intelligence Visualizer (`evb ui`)

Ever-Brain includes an embedded, high-density, real-time web visualizer and robust terminal engine accessible via `evb ui` or `http://localhost:3000/ui`:

* **Anytime Lifecycle (Dual-Phase Hydration)**: Launch the UI before, during, or after running commands; it automatically hydrates the current repository graph and historical activity timeline.
* **Interactive Knowledge & Skill Graph**: 60 FPS Canvas/SVG graph visualizing documents, skills, rules, and cross-references.
* **Broken Cross-Reference Radar**: Highlights unresolvable Markdown reference links (`⚠️ Broken Link`) with diagnostics.
* **Binary Asset Guard**: Safely displays image previews, file sizes, and delta metrics without corrupted text or crashes.
* **CRLF / LF Normalizer**: Strips cross-platform whitespace churn so diffs isolate true semantic changes.
* **Dual-Transport Resilience**: Real-time Server-Sent Events (SSE) with 3-second smart polling fallback for hosted/cloud environments.
* **1-Click Audit Exporter**: One-click download of `EVER_BRAIN_AUDIT.md` and clean print-to-PDF reports.

## 📄 License
MIT
