# Wiki: 04. MCP Specification & Agent Adapter

The **Ever-Brain MCP** (`packages/mcp`) is the agent consumption adapter. It translates Ever-Brain API capabilities into standard Model Context Protocol (MCP) primitives, allowing any MCP-compatible agent to consume project intelligence without local installation or configuration.

---

## 1. Dual Transport Architecture

The MCP server supports both modern and legacy MCP transport specifications:

```text
                               ┌─────────────────────────────┐
                               │         AI Agent            │
                               │ Cursor, Claude, OpenCode    │
                               └──────────────┬──────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         Streamable HTTP (2025-03-26)                       Legacy SSE (2024-11-05)
           POST /mcp/:owner/:repo                            GET /sse/:owner/:repo
           POST /mcp?repo=...                                GET /sse?repo=...
           DELETE /mcp (Session)                             POST /messages?sessionId=:id
                      │                                               │
                      └───────────────────────┬───────────────────────┘
                                              │
                                              ▼
                               ┌─────────────────────────────┐
                               │       Ever-Brain MCP        │
                               │  - Resources & Tools        │
                               │  - Error Ergonomics         │
                               │  - Stateless Per-Repo Context│
                               └──────────────┬──────────────┘
                                              │ HTTP JSON
                                              ▼
                               ┌─────────────────────────────┐
                               │       Ever-Brain API        │
                               └─────────────────────────────┘
```

### A. Streamable HTTP (MCP Spec 2025-03-26)
- Standardized endpoint: `POST /mcp/:owner/:repo` and `POST /mcp?repo=:url`.
- Session tracking via `Mcp-Session-Id` header.
- Explicit session termination via `DELETE /mcp`.

### B. Legacy SSE (MCP Spec 2024-11-05)
- Handshake endpoint: `GET /sse/:owner/:repo` and `GET /sse?repo=:url`.
- Messages endpoint: `POST /messages?sessionId=:sessionId`.
- Server-sent events streaming initial `endpoint` event and subsequent `message` events.

---

## 2. Dual Capability Declaration (ADR-007)

Autonomous ReAct coding agents (OpenCode, Cursor, Codex, Claude) often abort connections or fail with `-32601` method-not-found exceptions when connected to servers that declare only resources. 

Ever-Brain MCP declares **both** resources and tools capabilities:

```json
{
  "protocolVersion": "2024-11-05",
  "capabilities": {
    "resources": { "subscribe": false, "listChanged": false },
    "tools": { "listChanged": false }
  },
  "serverInfo": {
    "name": "ever-brain-mcp",
    "version": "1.0.0"
  }
}
```

---

## 3. Surface Mapping

### A. Resources Surface
1. **`resources/list`**:
   - Fetches repository tree from Ever-Brain API.
   - Maps files to `ever-brain://repo/{filePath}` resources with name, description, and MIME type.
2. **`resources/read`**:
   - Parses URI `ever-brain://repo/{filePath}` (also supports `evb://repo/{filePath}`).
   - Retrieves exact raw content from Ever-Brain API.
   - Returns standard `TextResourceContents`.

### B. Tools Surface
1. **`list_files`**:
   - Arguments: `filter_extension?: string`, `path_prefix?: string`.
   - Returns structured JSON listing of matching repository files.
2. **`read_file`**:
   - Arguments: `path: string`.
   - Returns exact raw file text or Markdown.
3. **`search_files`**:
   - Arguments: `query: string`, `path_prefix?: string`.
   - Returns matching files, hit counts, and line numbers.

---

## 4. Error Ergonomics

Tool invocations that encounter errors (such as missing files or bad parameters) return structured tool error responses rather than protocol-level exceptions:

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "Error executing read_file: File 'nonexistent.md' not found in repository acme/project (main)"
    }
  ]
}
```

This prevents agent disconnects and enables LLMs to correct queries and retry dynamically.
