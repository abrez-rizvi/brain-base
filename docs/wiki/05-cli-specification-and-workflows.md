# Wiki: 05. CLI Specification & Workflows

The **Ever-Brain CLI** (`packages/cli` / `evb`) is the developer and AI agent control plane for the Ever-Brain project intelligence layer. It connects workspaces to Ever-Brain sources, manages local caches, auto-bootstraps agent meta-skills, materializes runbooks into agent directories, and provides Read & Write collaboration via GitHub's native RBAC.

---

## 1. Zero SQLite & Pure Filesystem Architecture

All local configuration and state is plain human- and agent-readable YAML:

```text
my-project/
├── .evb/
│   ├── config.yaml          # Project binding (remote repo & branch)
│   ├── state.yaml           # Last sync timestamps, baseline source hashes (gitignored)
│   ├── auth.yaml            # Optional local credentials / token profile (gitignored)
│   └── cache/               # Local working mirror of knowledge/skills (gitignored)
│       ├── knowledge/
│       │   ├── architecture.md
│       │   └── conventions.md
│       └── skills/
│           ├── testing/
│           │   └── SKILL.md
│           └── api-design/
│               └── SKILL.md
├── .agents/skills/ever-brain/
│   └── SKILL.md             # Auto-bootstrapped Ever-Brain Meta-Skill for Agent
└── .gitignore               # Contains .evb/cache/, .evb/state.yaml, .evb/auth.yaml
```

---

## 2. Agent-First Ergonomics & Meta-Skill Bootstrapping

When `evb init` is executed, it automatically generates and installs the **`ever-brain` meta-skill** into:
- **Antigravity / Universal Standard**: `.agents/skills/ever-brain/SKILL.md` & `AGENTS.md`
- **Gemini**: `.gemini/skills/ever-brain/SKILL.md`
- **Cursor**: `.cursor/rules/ever-brain.mdc`
- **Claude Code**: `.claude/skills/ever-brain/SKILL.md`

This equips local AI agents to autonomously discover, read, update, push, and propose intelligence whenever the developer asks questions like:
- *"What's our rule on password hashing?"*
- *"Update the deployment runbook with the Redis timeout fix."*
- *"Propose a new skill for Docker Compose."*

---

## 3. GitHub Native RBAC (Read & Write Collaboration)

```text
                                  Developer / AI Agent
                                            │
                               ┌────────────┴────────────┐
                               ▼                         ▼
                       [Has Write Access]      [Read-Only / Needs Review]
                               │                         │
                               ▼                         ▼
                            evb push                  evb propose
                               │                         │
                         Direct Commit             Branch + Pull Request
                               │                         │
                               ▼                         ▼
                      GitHub Target Branch      GitHub PR Review UI
```

### A. Direct Commit (`evb push`)
- Used by maintainers and collaborators with `write` or `admin` access.
- Uses GitHub Git Data API to create a multi-file commit directly on the target branch.
- Updates `state.yaml` baseline immediately upon commit creation.

### B. Pull Request Proposal (`evb propose`)
- Used by contributors or when teams enforce Pull Request reviews.
- Checks user write access; automatically creates a user fork if no direct branch-creation permission exists on upstream.
- Creates a proposal branch, pushes changes, and opens a GitHub Pull Request with a clickable review URL.

---

## 4. Local Modification Tracking & Collision Protection

1. **Dirty State Detection**:
   - Compares local file SHA-256 hashes against `state.yaml` baseline hashes.
   - Categorizes changes into `M` (modified), `A` (added), and `D` (deleted).
2. **Unified Diffing (`evb diff`)**:
   - Emits raw unified diffs (`PAGER=cat` / `--json`) comparing local cached files with remote baseline text.
3. **Collision Protection**:
   - `evb sync` checks if local modifications exist before overwriting cache. If dirty, sync halts with an actionable warning unless `--force` is supplied.
4. **Reset (`evb reset`)**:
   - Discards uncommitted modifications and restores the remote baseline.

---

## 5. Command Reference

| Command | Description |
| :--- | :--- |
| `evb init [repoUrl]` | Connects workspace, creates config, syncs cache, and bootstraps agent meta-skill |
| `evb sync` | Synchronizes remote intelligence into local cache (collision protected) |
| `evb status` | Shows workspace connection, cache volume, and uncommitted modifications |
| `evb diff [path]` | Shows unified diff of local uncommitted modifications against baseline |
| `evb reset` | Discards local uncommitted modifications, restoring clean remote baseline |
| `evb push` | Directly commits local modifications to remote repository (write collaborators) |
| `evb propose` | Creates a proposal branch and opens a GitHub PR for team review |
| `evb auth login` | Authenticates with GitHub via PAT or GitHub CLI (explicit choice prompt) |
| `evb auth status` | Checks current GitHub authentication status and repository access level |
| `evb auth logout` | Clears stored GitHub authentication credentials |
| `evb knowledge list` | Lists all cached knowledge documents |
| `evb knowledge show <path>` | Displays content of a knowledge document |
| `evb skills list` | Lists all available project skills |
| `evb skills show <id>` | Renders a skill runbook in the terminal |
| `evb skills install <id>` | Materializes canonical skill into agent-native directories |

---

## 6. End-to-End Workflow: Using Ever-Brain on Any Local Workspace

Developers can attach Ever-Brain to any existing project on their machine:

1. **Globally Link CLI**:
   ```bash
   pnpm cli:link
   ```
   *(Or run `pnpm evb` directly inside the monorepo root).*
2. **Ensure API is running**:
   ```bash
   pnpm dev:api
   ```
3. **Navigate to external workspace**:
   ```bash
   cd ~/my-other-project  # or C:\Projects\MyOtherApp
   ```
4. **Initialize Ever-Brain connection**:
   ```bash
   evb init https://github.com/spencerpauly/skills-repo
   ```
5. **Observe automatic bootstrapping**:
   - Meta-skill `.agents/skills/ever-brain/SKILL.md` (and `.gemini/skills/ever-brain/` / `.cursor/rules/ever-brain.mdc` / `.claude/skills/ever-brain/`) is written.
   - Remote skills and knowledge are cached in `.evb/cache/`.
   - Your local agent immediately has access to search, list, and materialize skills for that workspace.
