import fs from 'node:fs';
import path from 'node:path';
import { resolverService } from './resolver-service.js';
import { githubService } from './github-service.js';
import { uiEventHub } from './ui-event-hub.js';
import { isBinaryOrIgnoredFile, BINARY_EXTENSIONS } from '../utils/binary-filter.js';

export interface GraphNode {
  id: string; // file path e.g. 'knowledge/architecture.md'
  label: string;
  type: 'knowledge' | 'skill' | 'rule' | 'asset' | 'config';
  sizeBytes: number;
  isBinary: boolean;
  mimeType?: string;
  description?: string;
  isDirty?: boolean;
  dirtyType?: 'modified' | 'added' | 'deleted';
  hasBrokenLinks?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  isBroken: boolean;
  rawTarget: string;
}

export interface UiStateSnapshot {
  repository: string;
  branch: string;
  defaultBranch: string;
  revision: number;
  timestamp: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    knowledgeCount: number;
    skillsCount: number;
    assetsCount: number;
    brokenLinksCount: number;
    dirtyCount: number;
  };
  recentEvents: ReturnType<typeof uiEventHub.getRecentEvents>;
}

export class UiStateService {
  /**
   * Parse markdown content to extract link targets.
   * Finds markdown links like [title](target.md) or [title](./knowledge/target.md).
   */
  extractMarkdownLinks(content: string): string[] {
    const links: string[] = [];
    // Match [text](url) where url is a relative markdown/asset link (not http:// or https:// or mailto:)
    const regex = /\[[^\]]*\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const rawTarget = match[1].trim().split('#')[0].split('?')[0];
      if (
        rawTarget &&
        !rawTarget.startsWith('http://') &&
        !rawTarget.startsWith('https://') &&
        !rawTarget.startsWith('mailto:') &&
        !rawTarget.startsWith('#')
      ) {
        links.push(rawTarget);
      }
    }

    return links;
  }

  /**
   * Resolve a relative link path against a source document path.
   */
  resolveRelativePath(sourcePath: string, linkTarget: string): string {
    const sourceDir = path.posix.dirname(sourcePath);
    let resolved = linkTarget.replace(/\\/g, '/');

    if (resolved.startsWith('/')) {
      resolved = resolved.replace(/^\/+/, '');
    } else {
      resolved = path.posix.normalize(path.posix.join(sourceDir, resolved));
    }

    return resolved.replace(/^\/+/, '');
  }

  /**
   * Parse simple YAML frontmatter (name, description, title).
   */
  parseFrontmatter(content: string): { title?: string; description?: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match || !match[1]) {
      return {};
    }

    const lines = match[1].split('\n');
    let title: string | undefined;
    let description: string | undefined;

    for (const line of lines) {
      const titleMatch = line.match(/^title:\s*["']?([^"'\r\n]+)["']?/i);
      const nameMatch = line.match(/^name:\s*["']?([^"'\r\n]+)["']?/i);
      const descMatch = line.match(/^description:\s*["']?([^"'\r\n]+)["']?/i);

      if (titleMatch && !title) title = titleMatch[1].trim();
      if (nameMatch && !title) title = nameMatch[1].trim();
      if (descMatch && !description) description = descMatch[1].trim();
    }

    return { title, description };
  }

  /**
   * Build complete graph snapshot from repository tree and raw files.
   */
  async buildSnapshot(
    owner: string,
    repo: string,
    branch?: string,
    localDirtyState?: { modified: string[]; added: string[]; deleted: string[] }
  ): Promise<UiStateSnapshot> {
    let targetBranch = branch;
    let defaultBranch = 'main';

    try {
      const meta = await githubService.getRepoMetadata(owner, repo);
      defaultBranch = meta.defaultBranch;
      if (!targetBranch) targetBranch = defaultBranch;
    } catch {
      if (!targetBranch) targetBranch = 'main';
    }

    const tree = await resolverService.getOrDiscoverFiles(owner, repo, targetBranch, false);
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const pathSet = new Set<string>();
    const nodeMap = new Map<string, GraphNode>();

    // 1. Create nodes from discovered remote files
    for (const file of tree.files) {
      const normalizedPath = file.path.replace(/\\/g, '/');
      pathSet.add(normalizedPath.toLowerCase());

      const ext = path.extname(normalizedPath).toLowerCase();
      const isBinary = BINARY_EXTENSIONS.has(ext);

      let nodeType: GraphNode['type'] = 'knowledge';
      if (normalizedPath.startsWith('skills/')) {
        nodeType = 'skill';
      } else if (
        normalizedPath.startsWith('.gemini/') ||
        normalizedPath.startsWith('.cursor/') ||
        normalizedPath.startsWith('.agents/') ||
        normalizedPath.startsWith('.claude/') ||
        normalizedPath.includes('rule')
      ) {
        nodeType = 'rule';
      } else if (isBinary) {
        nodeType = 'asset';
      } else if (normalizedPath.endsWith('.json') || normalizedPath.endsWith('.yaml') || normalizedPath.endsWith('.yml')) {
        nodeType = 'config';
      }

      const node: GraphNode = {
        id: normalizedPath,
        label: path.basename(normalizedPath),
        type: nodeType,
        sizeBytes: file.sizeBytes,
        isBinary,
        mimeType: file.mimeType,
      };

      nodes.push(node);
      nodeMap.set(normalizedPath, node);
    }

    // 1.5 Inspect local .evb/cache for active workspace additions & modifications
    const candidateCacheDirs = [
      path.resolve('D:/trial/.evb/cache'),
      path.resolve(process.cwd(), '.evb/cache'),
    ];

    for (const localCacheDir of candidateCacheDirs) {
      if (fs.existsSync(localCacheDir)) {
        const scanDir = (dir: string, baseRel = ''): string[] => {
          let list: string[] = [];
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const ent of entries) {
            const rel = baseRel ? `${baseRel}/${ent.name}` : ent.name;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
              list = list.concat(scanDir(full, rel));
            } else {
              list.push(rel.replace(/\\/g, '/'));
            }
          }
          return list;
        };

        const localFiles = scanDir(localCacheDir);
        for (const lf of localFiles) {
          const fullPath = path.join(localCacheDir, lf);
          const stat = fs.statSync(fullPath);
          const ext = path.extname(lf).toLowerCase();
          const isBinary = BINARY_EXTENSIONS.has(ext);

          let nodeType: GraphNode['type'] = 'knowledge';
          if (lf.startsWith('skills/')) {
            nodeType = 'skill';
          } else if (isBinary) {
            nodeType = 'asset';
          }

          const existing = nodeMap.get(lf);
          if (existing) {
            // Check if file is dirty/modified
            existing.sizeBytes = stat.size;
            existing.isDirty = true;
            existing.dirtyType = 'modified';
          } else {
            const newNode: GraphNode = {
              id: lf,
              label: path.basename(lf),
              type: nodeType,
              sizeBytes: stat.size,
              isBinary,
              mimeType: isBinary ? 'image/png' : 'text/markdown',
              isDirty: true,
              dirtyType: 'added',
            };
            nodes.push(newNode);
            nodeMap.set(lf, newNode);
            pathSet.add(lf.toLowerCase());
          }
        }
        break;
      }
    }

    // 2. Discover Edges by inspecting Markdown links
    let brokenLinksCount = 0;
    const inspectDocs = nodes.filter((n) => !n.isBinary && (n.type === 'knowledge' || n.type === 'skill')).slice(0, 40);

    for (const docNode of inspectDocs) {
      try {
        let content = '';
        for (const localCacheDir of candidateCacheDirs) {
          const localFile = path.join(localCacheDir, docNode.id);
          if (fs.existsSync(localFile)) {
            content = fs.readFileSync(localFile, 'utf8');
            break;
          }
        }

        if (!content) {
          const fileRes = await githubService.getRawFileContent(owner, repo, targetBranch!, docNode.id);
          if (fileRes.status === 200 && fileRes.content) {
            content = fileRes.content;
          }
        }

        if (content) {
          // Parse frontmatter metadata
          const fm = this.parseFrontmatter(content);
          if (fm.title) docNode.label = fm.title;
          if (fm.description) docNode.description = fm.description;

          // Parse markdown link targets
          const links = this.extractMarkdownLinks(content);
          for (const rawLink of links) {
            const resolvedTarget = this.resolveRelativePath(docNode.id, rawLink);
            const targetLower = resolvedTarget.toLowerCase();
            const exists = pathSet.has(targetLower);

            const isBroken = !exists;
            if (isBroken) {
              brokenLinksCount++;
              docNode.hasBrokenLinks = true;
            }

            const edgeId = `${docNode.id}->${resolvedTarget}`;
            if (!edges.some((e) => e.id === edgeId)) {
              edges.push({
                id: edgeId,
                source: docNode.id,
                target: resolvedTarget,
                isBroken,
                rawTarget: rawLink,
              });
            }
          }
        }
      } catch {
        // Non-blocking content retrieval for graph preview
      }
    }

    // Summary calculation
    const knowledgeCount = nodes.filter((n) => n.type === 'knowledge').length;
    const skillsCount = nodes.filter((n) => n.type === 'skill').length;
    const assetsCount = nodes.filter((n) => n.type === 'asset').length;
    const dirtyCount = nodes.filter((n) => n.isDirty).length;

    return {
      repository: `${owner}/${repo}`,
      branch: targetBranch!,
      defaultBranch,
      revision: uiEventHub.getRevision(),
      timestamp: new Date().toISOString(),
      nodes,
      edges,
      summary: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        knowledgeCount,
        skillsCount,
        assetsCount,
        brokenLinksCount,
        dirtyCount,
      },
      recentEvents: uiEventHub.getRecentEvents(30),
    };
  }

  /**
   * Generate clean GitHub-Flavored Markdown Intelligence Audit Report.
   */
  generateAuditMarkdown(snapshot: UiStateSnapshot): string {
    const lines: string[] = [];

    lines.push(`# Ever-Brain Intelligence Layer Audit Report`);
    lines.push(`\n**Repository**: \`${snapshot.repository}\` (Branch: \`${snapshot.branch}\`)`);
    lines.push(`**Generated**: ${snapshot.timestamp} | **State Revision**: \`rev: ${snapshot.revision}\``);
    lines.push(`\n---\n`);

    lines.push(`## 📊 Intelligence Layer Metrics\n`);
    lines.push(`| Metric | Count | Description |`);
    lines.push(`| :--- | :--- | :--- |`);
    lines.push(`| **Total Documents & Assets** | \`${snapshot.summary.totalNodes}\` | Total indexed nodes in repository |`);
    lines.push(`| **Knowledge Documents** | \`${snapshot.summary.knowledgeCount}\` | Architecture, runbooks & guides |`);
    lines.push(`| **Skills & Workflows** | \`${snapshot.summary.skillsCount}\` | Executable agent skills |`);
    lines.push(`| **Binary & Media Assets** | \`${snapshot.summary.assetsCount}\` | Images, diagrams, binaries |`);
    lines.push(`| **Knowledge Graph Edges** | \`${snapshot.summary.totalEdges}\` | Cross-document references |`);
    lines.push(`| **Broken References** | \`${snapshot.summary.brokenLinksCount}\` | Unresolved markdown link targets |`);
    lines.push(`| **Local Dirty Files** | \`${snapshot.summary.dirtyCount}\` | Uncommitted local modifications |`);

    if (snapshot.summary.brokenLinksCount > 0) {
      lines.push(`\n### ⚠️ Broken Knowledge References Detected\n`);
      lines.push(`The following documents contain links to missing target files:\n`);
      for (const edge of snapshot.edges.filter((e) => e.isBroken)) {
        lines.push(`- **Source**: \`${edge.source}\` → **Target**: \`${edge.target}\` *(raw: \`${edge.rawTarget}\`)*`);
      }
    }

    lines.push(`\n## 🗺️ Knowledge & Skill Inventory\n`);
    lines.push(`| Type | Path | Label | Status |`);
    lines.push(`| :--- | :--- | :--- | :--- |`);
    for (const node of snapshot.nodes) {
      const status = node.isDirty ? `📝 ${node.dirtyType?.toUpperCase()}` : '✅ In Sync';
      const typeBadge = node.type.toUpperCase();
      lines.push(`| \`${typeBadge}\` | \`${node.id}\` | ${node.label} | ${status} |`);
    }

    lines.push(`\n## ⚡ Recent Activity Log\n`);
    for (const evt of snapshot.recentEvents.slice(-15)) {
      lines.push(`- **[${evt.timestamp.split('T')[1].replace('Z', '')}]** \`${evt.type}\` ${evt.command ? `— \`${evt.command}\`` : ''} ${evt.message || ''}`);
    }

    lines.push(`\n---\n*Generated automatically by Ever-Brain Visualizer Engine.*`);

    return lines.join('\n');
  }
}

export const uiStateService = new UiStateService();
