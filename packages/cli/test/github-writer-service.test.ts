import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { githubWriterService } from '../src/services/github-writer-service.js';

describe('GitHubWriterService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates direct commit via GitHub Git Data API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // 1. get ref -> commitSha: 'c1'
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ object: { sha: 'c1' } }),
    } as unknown as Response);

    // 2. get commit -> treeSha: 't1'
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tree: { sha: 't1' } }),
    } as unknown as Response);

    // 3. create tree -> newTreeSha: 't2'
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ sha: 't2' }),
    } as unknown as Response);

    // 4. create commit -> newCommitSha: 'c2'
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ sha: 'c2', html_url: 'https://github.com/acme/repo/commit/c2' }),
    } as unknown as Response);

    // 5. update ref
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ object: { sha: 'c2' } }),
    } as unknown as Response);

    const result = await githubWriterService.createDirectCommit(
      'acme',
      'repo',
      'main',
      [{ path: 'knowledge/arch.md', content: '# New Content' }],
      'feat: update arch doc',
      'mock_token'
    );

    expect(result.commitSha).toBe('c2');
    expect(result.branch).toBe('main');
    expect(result.commitUrl).toContain('/commit/c2');
  });

  it('creates proposal pull request against upstream repository', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // 1. get ref
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ object: { sha: 'c1' } }),
    } as unknown as Response);

    // 2. get commit
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tree: { sha: 't1' } }),
    } as unknown as Response);

    // 3. create proposal branch ref
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ ref: 'refs/heads/evb/proposal-123' }),
    } as unknown as Response);

    // 4. create direct commit (get ref)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ object: { sha: 'c1' } }),
    } as unknown as Response);

    // 5. get commit
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tree: { sha: 't1' } }),
    } as unknown as Response);

    // 6. create tree
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ sha: 't2' }),
    } as unknown as Response);

    // 7. create commit
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ sha: 'c2' }),
    } as unknown as Response);

    // 8. update ref
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ object: { sha: 'c2' } }),
    } as unknown as Response);

    // 9. open PR
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ html_url: 'https://github.com/acme/repo/pull/42', number: 42 }),
    } as unknown as Response);

    const result = await githubWriterService.createProposalPullRequest(
      'acme',
      'repo',
      'main',
      [{ path: 'skills/test/SKILL.md', content: '# New Skill' }],
      'feat: Add test skill',
      'Documentation summary',
      'mock_token',
      'johndoe'
    );

    expect(result.pullRequestNumber).toBe(42);
    expect(result.pullRequestUrl).toBe('https://github.com/acme/repo/pull/42');
    expect(result.isFork).toBe(false);
  });

  it('creates proposal pull request via existing fork when direct ref creation is 403', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // 1. get ref on upstream
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ object: { sha: 'upstream_commit_1' } }),
    } as unknown as Response);

    // 2. get commit on upstream
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tree: { sha: 'upstream_tree_1' } }),
    } as unknown as Response);

    // 3. create proposal branch ref on upstream -> 403 Forbidden
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as unknown as Response);

    // 4. check if fork exists -> 200 OK (exists)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 123, name: 'repo' }),
    } as unknown as Response);

    // 5. get ref on fork (main)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ object: { sha: 'fork_commit_1' } }),
    } as unknown as Response);

    // 6. get commit on fork (main)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tree: { sha: 'fork_tree_1' } }),
    } as unknown as Response);

    // 7. create ref on fork
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ ref: 'refs/heads/evb/proposal-456' }),
    } as unknown as Response);

    // 8. createDirectCommit: get ref on fork (proposal branch)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ object: { sha: 'fork_commit_1' } }),
    } as unknown as Response);

    // 9. createDirectCommit: get commit
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tree: { sha: 'fork_tree_1' } }),
    } as unknown as Response);

    // 10. createDirectCommit: create tree
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ sha: 'fork_tree_2' }),
    } as unknown as Response);

    // 11. createDirectCommit: create commit
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ sha: 'fork_commit_2' }),
    } as unknown as Response);

    // 12. createDirectCommit: update ref
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ object: { sha: 'fork_commit_2' } }),
    } as unknown as Response);

    // 13. open PR on upstream
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ html_url: 'https://github.com/acme/repo/pull/99', number: 99 }),
    } as unknown as Response);

    const result = await githubWriterService.createProposalPullRequest(
      'acme',
      'repo',
      'main',
      [{ path: 'knowledge/test.md', content: '# Proposal Content' }],
      'feat: proposal via existing fork',
      'Proposal message',
      'mock_token',
      'johndoe'
    );

    expect(result.pullRequestNumber).toBe(99);
    expect(result.pullRequestUrl).toBe('https://github.com/acme/repo/pull/99');
    expect(result.isFork).toBe(true);
  });
});
