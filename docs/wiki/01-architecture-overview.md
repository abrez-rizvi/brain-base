# Wiki: 01. Architecture Overview

## The Alignment Problem in AI-Assisted Development

Modern software engineering teams frequently deploy diverse AI agents alongside human developers:

```text
Developer A → Claude
Developer B → Cursor
Developer C → Gemini / Antigravity
Developer D → Codex / OpenCode
```

Each agent environment operates with distinct context windows, custom prompt rules, disjoint local memory, and independent configurations. Yet, all contributors are reading and modifying the **same shared codebase**.

Without a unified intelligence layer, context fragments:
- Architectural invariants are violated.
- Setup procedures and troubleshooting runbooks are rediscovered repeatedly.
- Agent instructions must be duplicated across disparate config files (`.cursor/rules`, `~/.gemini/skills`, `.claude/skills`).

---

## The Ever-Brain Paradigm

> **"Git stores what the project IS; Ever-Brain stores what the project KNOWS."**

Ever-Brain establishes an agent-agnostic, portable layer that houses the project's knowledge and operational skills directly alongside the codebase or in dedicated project knowledge repositories.

```text
                        PROJECT
                           │
                           ▼
                     ┌───────────┐
                     │ EVER-BRAIN│
                     │           │
                     │ Knowledge │
                     │ Skills    │
                     │ Context   │
                     └─────┬─────┘
                           │
               ┌───────────┼───────────┐
               ▼           ▼           ▼
            Agent        Agent       Human
```

---

## The 3-Tier Model

To serve both autonomous AI agents and human developers efficiently without imposing unnecessary friction, Ever-Brain separates concerns across three decoupled tiers:

```text
                         GitHub / Raw CDN (Persistence & Git)
                                           │
                                           ▼
                               Ever-Brain API (Source Layer)
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
                   Ever-Brain MCP                        Ever-Brain CLI (evb)
             (Agent Consumption Adapter)          (Developer Control Plane)
                        │                                     │
                        ▼                                     ▼
                    AI Agents                         Local Environment / IDE
```

### 1. Ever-Brain API (`packages/api`) — Source Layer
- **Core Responsibility**: Provide a stateless, high-performance abstraction over GitHub and raw CDNs.
- **Contract**: Resolves repository branches, discovers non-binary project documentation, streams exact file content, and performs plain-text searching.
- **Semantic Agnosticism**: The API has **zero awareness** of "skills" or "knowledge" categorizations. It exclusively manages *files* (`path`, `content`, `sizeBytes`, `mimeType`).

### 2. Ever-Brain MCP (`packages/mcp`) — Agent Adapter (Tier 2)
- **Core Responsibility**: Expose project intelligence to MCP-compatible AI agents over standard protocols (Streamable HTTP and Legacy SSE).
- **Surface**:
  - **Resources**: `ever-brain://repo/path` for persistent project documents.
  - **Tools**: `list_files`, `read_file`, `search_files` to guarantee ReAct agent compatibility without connection termination.
- **Stateless & Zero-Friction**: Teammates can connect an agent to an Ever-Brain MCP endpoint with zero local installation or state.

### 3. Ever-Brain CLI (`packages/cli` / `evb`) — Developer Control Plane (Tier 3)
- **Core Responsibility**: Give human developers local control, speed, and IDE integration.
- **Capabilities**:
  - `evb init` & `evb sync`: Disposable machine-local caching in `.evb/cache/`.
  - `evb skills install`: Materialize canonical Markdown skills into agent-native directories (`~/.gemini/skills/`, `.cursor/rules/`, `.claude/skills/`).
  - Pure filesystem storage: **Zero SQLite, zero local daemons, zero opaque databases**.

---

## Architectural Invariants & Scope Boundaries

| Invariant / Decision | Rule | Rationale |
| :--- | :--- | :--- |
| **Storage Substrate** | GitHub + In-Memory Cache | Avoids premature database infrastructure; Git handles versioning, diffs, and collaboration natively. |
| **API Content Policy** | Exact Byte Preservation | The API never modifies, summarizes, or injects LLM metadata into served files. |
| **State Boundaries** | API: Stateless, MCP: Stateless, CLI: Local FS | Keeps network tiers horizontally scalable and simple to operate. |
| **Mutation & Write-Back** | GitHub-native RBAC | `evb push` for direct commits by maintainers, `evb propose` for team PR reviews. |
| **Local State Storage** | Plain YAML/JSON only (`.evb/`) | Keeps local configuration inspectable and disposable without database dependencies. |
