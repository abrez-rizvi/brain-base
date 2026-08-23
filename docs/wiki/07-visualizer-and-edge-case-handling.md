# 07. Ever-Brain Live Visualizer & Robust Edge-Case Handling

> **"A resilient developer tool must represent state accurately without failing under real-world edge cases."**

The **Ever-Brain Visualizer** provides real-time, dynamic visibility into repository intelligence, cross-document relationships, and working tree modifications through both a minimal, high-density web cockpit (`evb ui` / `http://localhost:3000/ui`) and a fortified terminal visualizer (`evb diff`, `evb status`).

---

## 🏛️ Architecture & Transport Resilience

```text
┌────────────────────────────────────────────────────────┐
│               Terminal CLI (`evb` commands)            │
│   (e.g., evb init, evb sync, evb diff, local edits)   │
└───────────────────────────┬────────────────────────────┘
                            │ Non-blocking fire-and-forget POST (150ms timeout)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Ever-Brain API Engine (:3000)              │
│   • In-memory UI Event Hub with 100-event ring buffer  │
│   • Monotonic State Revision Counter (`rev: 42`)       │
│   • Knowledge Graph Resolver & Broken Link Analyzer    │
└───────────────────────────┬────────────────────────────┘
                            │
               ┌────────────┴────────────┐
               │                         │
     Primary Transport:          Fallback Transport:
    Server-Sent Events (SSE)     3-Second Smart Polling
    (Low latency / local dev)   (Buffering reverse proxies)
               │                         │
               └────────────┬────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│          Ever-Brain Minimalist Web Visualizer          │
│   • HTML5 Canvas 2D Force-Directed Graph Engine        │
│   • Resilient Side-by-Side & Unified Diff Viewer       │
│   • Real-Time Command & Telemetry Stream               │
│   • 1-Click Markdown & Print-to-PDF Exporters          │
└────────────────────────────────────────────────────────┘
```

---

## 🛡️ Edge Cases Handled Without Failure or Data Corruption

| Edge Case | Failure Mode in Standard Tools | Ever-Brain Robust Solution |
| :--- | :--- | :--- |
| **1. Binary Assets (`.png`, `.pdf`, `.zip`, `.wasm`)** | Passing binary buffers to string diff algorithms dumps unreadable ANSI garbage into terminal/DOM or crashes. | Automatic null-byte & extension inspection. Renders a dedicated **Binary Asset Card** displaying byte deltas (`120 KB -> 158 KB (+38 KB)`) and image previews safely. |
| **2. CRLF vs LF Mixed Line Endings** | Checking out files on Windows vs Linux causes 100% of lines to appear modified due to `\r\n` vs `\n`. | Built-in **CRLF Normalization Engine** removes carriage return noise so only true semantic text changes are visualized. |
| **3. Massive Document Overflow (10,000+ lines)** | Gigantic diffs lock the terminal scrollback or freeze the browser JavaScript thread. | Virtualized diff folding truncates large blocks beyond 120 lines with an on-demand `[Show 450 folded lines...]` expander. |
| **4. Broken Cross-References & Missing Targets** | Markdown files referencing non-existent documents (`[Guide](./ghost.md)`) cause agents to hallucinate. | Live AST Link Scanner detects dangling targets, highlighting red dashed edges and `⚠️ BROKEN_LINK` diagnostic cards. |
| **5. Anytime Launch & Post-Execution Hydration** | Launching a UI after running commands shows an empty screen or misses recent actions. | **Dual-Phase Hydration**: `GET /ui/state` fetches the authoritative snapshot and the last 50 events from the in-memory ring buffer in `< 15ms`. |
| **6. Disconnect & Network Flapping** | Terminal process sleeps or reverse proxy drops SSE. | **Dual-Transport Resilience**: UI automatically falls back to 3-second smart polling and auto-reconnects with UUID deduplication. |

---

## 🎬 Realistic End-to-End User Flow (Demo Guide)

1. **Launch Visualizer**:
   ```bash
   evb ui
   ```
   * The browser opens `http://localhost:3000/ui` showing the high-density cockpit in `Awaiting Workspace Connection` mode.

2. **Connect Intelligence Repository in Terminal**:
   ```bash
   evb init https://github.com/spencerpauly/skills-repo
   ```
   * The web visualizer dynamically blossoms into an interactive knowledge graph in real time without refreshing.

3. **Simulate Real-World Edge Cases**:
   * Add a binary image asset to `.evb/cache/architecture.png`.
   * Add a broken reference link `[Missing Runbook](./knowledge/ghost.md)` in a Markdown file.
   * Modify a file with Windows `\r\n` line endings.

4. **Observe Real-Time Visual Resilience**:
   * `evb diff` in terminal cleanly displays binary asset deltas without garbled characters and normalizes CRLF.
   * Web Visualizer highlights the broken reference link with a red warning badge.
   * Binary file is displayed with an asset inspection card.

5. **Export Intelligence Audit**:
   * Click **[📄 Export MD]** to download `EVER_BRAIN_AUDIT.md`.
   * Click **[🖨️ Print / PDF]** to generate a clean, vector-rendered documentation report.
