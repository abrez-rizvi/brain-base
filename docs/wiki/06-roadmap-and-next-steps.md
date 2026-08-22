# Wiki: 06. Roadmap & Next Steps

All three core tiers of **Ever-Brain V1** are fully implemented, tested, and verified:
1. **Ever-Brain API (`packages/api`)**: Stateless content access layer (TypeScript + Hono).
2. **Ever-Brain MCP (`packages/mcp`)**: Agent consumption adapter (Streamable HTTP + SSE, Dual Resources + Tools).
3. **Ever-Brain CLI (`packages/cli` / `evb`)**: Developer & agent control plane with auto-bootstrapped meta-skills, delta sync, dirty-state diffing, and GitHub-native RBAC (`push` / `propose`).

```text
  [Phase 1: COMPLETE]           [Phase 2: COMPLETE]           [Phase 3: COMPLETE]
  Ever-Brain API V1             Ever-Brain MCP V1             Ever-Brain CLI V1
  ┌──────────────┐              ┌──────────────┐              ┌──────────────┐
  │ - Git Trees  │              │ - Streamable │              │ - No SQLite  │
  │ - Raw CDN    │ ───────────► │   HTTP / SSE │ ───────────► │ - Sync/Cache │
  │ - 60s Cache  │              │ - Resources  │              │ - Meta-Skill │
  │ - Substring  │              │ - Tools      │              │ - Status/Diff│
  │   Search     │              │ - Dual surf. │              │ - Push/PR    │
  └──────────────┘              └──────────────┘              └──────────────┘
```

---

## 🚀 Cloud Deployment & Production Hardening (Supabase)

The next step is deploying the cloud-hosted production backend on **Supabase**:
1. **Supabase Edge Functions Deployment**:
   - Deploy `packages/api` to Supabase Edge Functions / Deno runtime (`https://<project-ref>.supabase.co/functions/v1/api`).
   - Deploy `packages/mcp` to Supabase Edge Functions (`https://<project-ref>.supabase.co/functions/v1/mcp`).
2. **Custom Domain & TLS**:
   - Route `api.everbrain.dev` and `mcp.everbrain.dev` to the Supabase infrastructure.
3. **Global Rate-Limiting & Redis Edge Cache**:
   - Optional Upstash Redis cache layer at the edge for high-traffic public repositories.

---

## 🔮 V2 Vision & Autonomous Evolution

- **Continuous Learning Loops**: Automated staging queues where agents propose runbook refinements after fixing complex bugs during pairing sessions.
- **Federated Verification Runbooks**: Sandboxed execution of project verification scripts directly inside CI/CD or staging environments.
- **Commit Drift Tracking**: Automatic staleness alerts when underlying code changes exceed diff thresholds (>40%).
