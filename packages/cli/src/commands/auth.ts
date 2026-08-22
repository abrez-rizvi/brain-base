import { authService } from '../services/auth-service.js';
import { projectConfigManager } from '../config/project-config.js';
import { parseRepoUrl } from '../services/sync-service.js';
import { logger } from '../utils/logger.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';

export interface AuthLoginOptions extends OutputOptions {
  token?: string;
  useGh?: boolean;
}

export async function handleAuthLogin(options: AuthLoginOptions = {}): Promise<void> {
  try {
    const { token, sourceType } = await authService.promptForAuth(options);
    const userInfo = await authService.validateToken(token);

    authService.saveGlobalToken(token, userInfo.username, sourceType);

    outputResult(
      {
        status: 'authenticated',
        username: userInfo.username,
        sourceType,
        scopes: userInfo.scopes,
      },
      options,
      () => {
        logger.success(`Authenticated as @${userInfo.username} via ${sourceType}`);
        logger.info(`Scopes: ${userInfo.scopes.join(', ') || 'none'}`);
        logger.success(`Token saved securely to global profile (~/.evb/auth.json)`);
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'AUTH_ERROR', options);
  }
}

export async function handleAuthStatus(options: OutputOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findEvbRoot() || undefined;
  const token = authService.resolveToken(undefined, workspaceRoot);

  if (!token) {
    outputResult(
      {
        authenticated: false,
        message: 'No GitHub token configured. Run evb auth login to authenticate.',
      },
      options,
      () => {
        logger.warn('Not authenticated. Run evb auth login or set GITHUB_TOKEN / EVB_GITHUB_TOKEN.');
      }
    );
    return;
  }

  try {
    const userInfo = await authService.validateToken(token);

    let permission = 'unknown';
    if (workspaceRoot) {
      try {
        const config = projectConfigManager.readConfig(workspaceRoot);
        const { owner, repo } = parseRepoUrl(config.source.repository);
        permission = await authService.getRepoPermission(owner, repo, userInfo.username, token);
      } catch {}
    }

    outputResult(
      {
        authenticated: true,
        username: userInfo.username,
        scopes: userInfo.scopes,
        repositoryPermission: permission,
      },
      options,
      () => {
        logger.success(`Authenticated as @${userInfo.username}`);
        logger.info(`Scopes: ${userInfo.scopes.join(', ') || 'none'}`);
        if (permission !== 'unknown') {
          logger.info(`Repository Access Level: ${permission}`);
        }
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'AUTH_VALIDATION_ERROR', options);
  }
}

export async function handleAuthLogout(options: OutputOptions = {}): Promise<void> {
  try {
    authService.clearGlobalToken();
    outputResult(
      {
        status: 'logged_out',
        message: 'Stored credentials cleared.',
      },
      options,
      () => {
        logger.success('Logged out and cleared stored authentication profile.');
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'LOGOUT_ERROR', options);
  }
}
