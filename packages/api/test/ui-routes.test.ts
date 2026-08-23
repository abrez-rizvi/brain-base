import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../src/app.js';
import { githubService } from '../src/services/github-service.js';
import { uiEventHub } from '../src/services/ui-event-hub.js';

describe('UI Routes (/ui)', () => {
  beforeEach(() => {
    uiEventHub.clearEvents();
  });

  it('GET /ui should return HTML visualizer', async () => {
    const res = await app.request('/ui');
    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') || '';
    expect(contentType).toContain('text/html');
    const text = await res.text();
    expect(text).toContain('EVER-BRAIN');
    expect(text).toContain('graphCanvas');
  });

  it('POST /ui/events should accept telemetry and return ok status with UUID', async () => {
    const res = await app.request('/ui/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sync',
        command: 'sync',
        message: 'Sync completed: 18 files',
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.id).toBeDefined();
    expect(json.rev).toBeGreaterThan(0);
  });

  it('GET /ui/state should return snapshot structure with graph and summary', async () => {
    // Mock GitHub API calls
    vi.spyOn(githubService, 'getRepoMetadata').mockResolvedValue({
      owner: 'testowner',
      repo: 'testrepo',
      defaultBranch: 'main',
    });

    vi.spyOn(githubService, 'getGitTree').mockResolvedValue([
      { path: 'README.md', mode: '100644', type: 'blob', sha: '111', size: 100 },
      { path: 'knowledge/arch.md', mode: '100644', type: 'blob', sha: '222', size: 250 },
      { path: 'skills/deploy/SKILL.md', mode: '100644', type: 'blob', sha: '333', size: 300 },
      { path: 'assets/diagram.png', mode: '100644', type: 'blob', sha: '444', size: 4000 },
    ]);

    vi.spyOn(githubService, 'getRawFileContent').mockImplementation(async (owner, repo, branch, path) => {
      if (path === 'knowledge/arch.md') {
        return {
          status: 200,
          content: '# Architecture\nSee [Deploy Guide](../skills/deploy/SKILL.md) and [Missing](./ghost.md).',
        };
      }
      return { status: 200, content: '# General' };
    });

    const res = await app.request('/ui/state?repo=testowner/testrepo');
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.repository).toBe('testowner/testrepo');
    expect(data.branch).toBe('main');
    expect(data.nodes.length).toBeGreaterThanOrEqual(3);
    expect(data.summary).toBeDefined();
    expect(data.summary.totalNodes).toBeGreaterThanOrEqual(3);

    // Verify broken link detection
    const brokenEdge = data.edges.find((e: any) => e.isBroken);
    expect(brokenEdge).toBeDefined();
    expect(brokenEdge.target).toContain('ghost.md');
  });

  it('GET /ui/export/md should return Markdown audit report with attachment headers', async () => {
    const res = await app.request('/ui/export/md?repo=testowner/testrepo');
    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') || '';
    expect(contentType).toContain('text/markdown');
    const contentDisposition = res.headers.get('content-disposition') || '';
    expect(contentDisposition).toContain('EVER_BRAIN_AUDIT.md');

    const md = await res.text();
    expect(md).toContain('# Ever-Brain Intelligence Layer Audit Report');
    expect(md).toContain('## 📊 Intelligence Layer Metrics');
  });
});
