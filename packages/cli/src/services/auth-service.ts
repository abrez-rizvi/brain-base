import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import prompts from 'prompts';
import { GLOBAL_KNOWIKI_DIR, GLOBAL_AUTH_FILE, AUTH_FILE, KNOWIKI_DIR } from '../config/constants.js';

export interface AuthProfile {
  username?: string;
  token?: string;
  sourceType: 'pat' | 'gh_cli' | 'env';
  savedAt: string;
}

export class AuthService {
  detectGhCliToken(): string | null {
    try {
      const output = execSync('gh auth token', {
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
      }).trim();
      return output || null;
    } catch {
      return null;
    }
  }

  getStoredToken(workspaceRoot?: string): string | null {
    // 1. Check workspace-local .knowiki/auth.yaml
    if (workspaceRoot) {
      const localAuthPath = path.join(workspaceRoot, KNOWIKI_DIR, AUTH_FILE);
      if (fs.existsSync(localAuthPath)) {
        try {
          const content = fs.readFileSync(localAuthPath, 'utf8');
          const match = content.match(/token:\s*["']?([^"'\r\n]+)["']?/);
          if (match && match[1]) return match[1].trim();
        } catch {}
      }
    }

    // 2. Check global ~/.knowiki/auth.json
    if (fs.existsSync(GLOBAL_AUTH_FILE)) {
      try {
        const json = JSON.parse(fs.readFileSync(GLOBAL_AUTH_FILE, 'utf8')) as AuthProfile;
        if (json.token) return json.token.trim();
      } catch {}
    }

    return null;
  }

  resolveToken(explicitToken?: string, workspaceRoot?: string): string | null {
    if (explicitToken && explicitToken.trim()) {
      return explicitToken.trim();
    }

    if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) {
      return process.env.GITHUB_TOKEN.trim();
    }

    return this.getStoredToken(workspaceRoot);
  }

  saveGlobalToken(token: string, username?: string, sourceType: 'pat' | 'gh_cli' = 'pat'): void {
    if (!fs.existsSync(GLOBAL_KNOWIKI_DIR)) {
      fs.mkdirSync(GLOBAL_KNOWIKI_DIR, { recursive: true });
    }

    const profile: AuthProfile = {
      username,
      token,
      sourceType,
      savedAt: new Date().toISOString(),
    };

    fs.writeFileSync(GLOBAL_AUTH_FILE, JSON.stringify(profile, null, 2), 'utf8');
  }

  clearGlobalToken(): void {
    if (fs.existsSync(GLOBAL_AUTH_FILE)) {
      fs.unlinkSync(GLOBAL_AUTH_FILE);
    }
  }

  async promptForAuth(options?: { useGh?: boolean; token?: string }): Promise<{
    token: string;
    sourceType: 'pat' | 'gh_cli';
  }> {
    if (options?.token) {
      return { token: options.token.trim(), sourceType: 'pat' };
    }

    const ghToken = this.detectGhCliToken();

    if (options?.useGh && ghToken) {
      return { token: ghToken, sourceType: 'gh_cli' };
    }

    // If GitHub CLI is available, explicitly ask the user for their preference
    if (ghToken) {
      const response = await prompts({
        type: 'select',
        name: 'choice',
        message: 'Detected GitHub CLI (gh). How would you like to authenticate?',
        choices: [
          { title: 'Use active GitHub CLI token (gh auth token)', value: 'gh' },
          { title: 'Enter a GitHub Personal Access Token (PAT) manually', value: 'pat' },
        ],
      });

      if (response.choice === 'gh') {
        return { token: ghToken, sourceType: 'gh_cli' };
      }
    }

    // Prompt for manual PAT
    const patResponse = await prompts({
      type: 'password',
      name: 'pat',
      message: 'Enter your GitHub Personal Access Token (PAT):',
      validate: (value) => (value && value.trim().length > 0 ? true : 'Token cannot be empty'),
    });

    if (!patResponse.pat) {
      throw new Error('Authentication cancelled.');
    }

    return { token: patResponse.pat.trim(), sourceType: 'pat' };
  }

  async validateToken(token: string): Promise<{ username: string; scopes: string[] }> {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'User-Agent': 'Knowiki-CLI/1.0',
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Invalid GitHub token (status ${res.status}). Ensure your PAT is valid.`);
    }

    const scopesHeader = res.headers.get('x-oauth-scopes') || '';
    const scopes = scopesHeader.split(',').map((s) => s.trim()).filter(Boolean);
    const data = (await res.json()) as { login: string };

    return {
      username: data.login,
      scopes,
    };
  }

  async getRepoPermission(
    owner: string,
    repo: string,
    username: string,
    token: string
  ): Promise<'admin' | 'write' | 'read' | 'none'> {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators/${encodeURIComponent(username)}/permission`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Knowiki-CLI/1.0',
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 404) {
      return 'none';
    }

    if (!res.ok) {
      return 'none';
    }

    const data = (await res.json()) as { permission?: string };
    if (data.permission === 'admin') return 'admin';
    if (data.permission === 'write' || data.permission === 'push') return 'write';
    if (data.permission === 'read' || data.permission === 'pull') return 'read';
    return 'none';
  }
}

export const authService = new AuthService();
