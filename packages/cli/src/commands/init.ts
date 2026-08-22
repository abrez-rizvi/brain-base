import prompts from 'prompts';
import { projectConfigManager } from '../config/project-config.js';
import { syncService, parseRepoUrl } from '../services/sync-service.js';
import { metaSkillService } from '../services/meta-skill-service.js';
import { CliApiClient } from '../client/api-client.js';
import { logger } from '../utils/logger.js';
import { outputResult, outputError } from '../utils/output.js';

export interface InitCommandOptions {
  branch?: string;
  yes?: boolean;
  noAgentSkill?: boolean;
  apiUrl?: string;
  json?: boolean;
}

export async function handleInit(
  repoUrlArg?: string,
  options: InitCommandOptions = {}
): Promise<void> {
  const workspaceRoot = process.cwd();

  let repoUrl = repoUrlArg;
  if (!repoUrl) {
    if (!options.yes && process.stdout.isTTY) {
      const response = await prompts({
        type: 'text',
        name: 'repo',
        message: 'Enter Ever-Brain source GitHub repository (e.g. owner/repo or URL):',
        validate: (value) => (value && value.trim().length > 0 ? true : 'Repository URL is required'),
      });
      repoUrl = response.repo;
    }

    if (!repoUrl) {
      return outputError('Repository URL is required. Usage: evb init <owner/repo>', 'INVALID_ARGS', options);
    }
  }

  try {
    const { owner, repo } = parseRepoUrl(repoUrl);
    const apiUrl = options.apiUrl || projectConfigManager.getApiUrl();
    const client = new CliApiClient(apiUrl);

    let defaultBranch = options.branch;
    if (!defaultBranch) {
      try {
        const meta = await client.getRepoMetadata(owner, repo);
        defaultBranch = meta.defaultBranch;
      } catch {
        defaultBranch = 'main';
      }
    }

    // 1. Write .evb/config.yaml
    projectConfigManager.writeConfig(workspaceRoot, {
      version: 1,
      source: {
        repository: `https://github.com/${owner}/${repo}`,
        branch: defaultBranch,
        api_url: options.apiUrl || undefined,
      },
    });

    // 2. Ensure .gitignore entries
    projectConfigManager.ensureGitignore(workspaceRoot);

    // 3. Initial sync
    const syncRes = await syncService.sync(workspaceRoot, { client, force: true });

    // 4. Auto-bootstrap agent meta-skill
    let bootstrapped: string[] = [];
    if (!options.noAgentSkill) {
      const metaRes = metaSkillService.bootstrapMetaSkill(workspaceRoot);
      bootstrapped = metaRes.installedLocations;
    }

    outputResult(
      {
        status: 'initialized',
        repository: `${owner}/${repo}`,
        branch: defaultBranch,
        filesCached: syncRes.total,
        metaSkillsInstalled: bootstrapped,
      },
      options,
      () => {
        logger.success(`Resolved repository: ${owner}/${repo} (branch: ${defaultBranch})`);
        logger.success(`Created local configuration: .evb/config.yaml`);
        logger.success(`Updated .gitignore for cache and state files`);
        logger.success(`Synchronized ${syncRes.total} files into local cache`);
        if (bootstrapped.length > 0) {
          logger.success(`Bootstrapped agent meta-skill in: ${bootstrapped.join(', ')}`);
        }
        console.log(`\n✨ Ever-Brain connected successfully! Run 'evb status' to view details.`);
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'INIT_ERROR', options);
  }
}
