import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { authService } from '../src/services/auth-service.js';
import { GLOBAL_AUTH_FILE } from '../src/config/constants.js';

describe('AuthService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(GLOBAL_AUTH_FILE)) {
      try {
        fs.unlinkSync(GLOBAL_AUTH_FILE);
      } catch {}
    }
  });

  it('validates a GitHub token via GitHub API mock', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'x-oauth-scopes': 'repo, read:user',
      }),
      json: async () => ({ login: 'octocat' }),
    } as unknown as Response);

    const result = await authService.validateToken('mock_token_123');
    expect(result.username).toBe('octocat');
    expect(result.scopes).toEqual(['repo', 'read:user']);
  });

  it('determines collaborator repo permission level', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ permission: 'admin' }),
    } as unknown as Response);

    const perm = await authService.getRepoPermission('acme', 'project', 'octocat', 'mock_token');
    expect(perm).toBe('admin');
  });

  it('saves and clears global auth profiles', () => {
    authService.saveGlobalToken('test_pat_token', 'johndoe', 'pat');

    const token = authService.resolveToken();
    expect(token).toBe('test_pat_token');

    authService.clearGlobalToken();
    const tokenAfterClear = authService.resolveToken();
    expect(tokenAfterClear).toBeNull();
  });
});
