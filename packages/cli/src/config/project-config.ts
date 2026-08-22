import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  EVB_DIR,
  CONFIG_FILE,
  STATE_FILE,
  CACHE_DIR,
  getDefaultApiUrl,
} from './constants.js';

export interface EverBrainSourceConfig {
  repository: string;
  branch: string;
  api_url?: string;
}

export interface EverBrainProjectConfig {
  version: number;
  source: EverBrainSourceConfig;
}

export interface EverBrainState {
  last_sync: string;
  source_revision: string;
  cached_files: number;
  files: Record<string, string>; // path -> sha256
}

export class ProjectConfigManager {
  findEvbRoot(startDir = process.cwd()): string | null {
    let currentDir = path.resolve(startDir);
    while (true) {
      const evbPath = path.join(currentDir, EVB_DIR);
      const configPath = path.join(evbPath, CONFIG_FILE);
      if (fs.existsSync(configPath)) {
        return currentDir;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
    return null;
  }

  getEvbDirPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, EVB_DIR);
  }

  getConfigFilePath(workspaceRoot: string): string {
    return path.join(workspaceRoot, EVB_DIR, CONFIG_FILE);
  }

  getStateFilePath(workspaceRoot: string): string {
    return path.join(workspaceRoot, EVB_DIR, STATE_FILE);
  }

  getCacheDirPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, EVB_DIR, CACHE_DIR);
  }

  readConfig(workspaceRoot: string): EverBrainProjectConfig {
    const configPath = this.getConfigFilePath(workspaceRoot);
    if (!fs.existsSync(configPath)) {
      throw new Error(
        `Ever-Brain configuration not found at '${configPath}'. Run 'evb init' first.`
      );
    }

    const content = fs.readFileSync(configPath, 'utf8');
    const parsed = YAML.parse(content) as EverBrainProjectConfig;
    if (!parsed || !parsed.source || !parsed.source.repository) {
      throw new Error(`Invalid Ever-Brain configuration in '${configPath}'.`);
    }
    return parsed;
  }

  writeConfig(workspaceRoot: string, config: EverBrainProjectConfig): void {
    const evbDir = this.getEvbDirPath(workspaceRoot);
    if (!fs.existsSync(evbDir)) {
      fs.mkdirSync(evbDir, { recursive: true });
    }

    const configPath = this.getConfigFilePath(workspaceRoot);
    const yamlStr = YAML.stringify(config);
    fs.writeFileSync(configPath, yamlStr, 'utf8');
  }

  readState(workspaceRoot: string): EverBrainState | null {
    const statePath = this.getStateFilePath(workspaceRoot);
    if (!fs.existsSync(statePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(statePath, 'utf8');
      return YAML.parse(content) as EverBrainState;
    } catch {
      return null;
    }
  }

  writeState(workspaceRoot: string, state: EverBrainState): void {
    const evbDir = this.getEvbDirPath(workspaceRoot);
    if (!fs.existsSync(evbDir)) {
      fs.mkdirSync(evbDir, { recursive: true });
    }

    const statePath = this.getStateFilePath(workspaceRoot);
    const yamlStr = YAML.stringify(state);
    fs.writeFileSync(statePath, yamlStr, 'utf8');
  }

  ensureGitignore(workspaceRoot: string): void {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    const entriesToAdd = [
      `${EVB_DIR}/${CACHE_DIR}/`,
      `${EVB_DIR}/${STATE_FILE}`,
      `${EVB_DIR}/auth.yaml`,
    ];

    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf8');
    }

    const lines = content.split(/\r?\n/).map((l) => l.trim());
    const missing = entriesToAdd.filter((entry) => !lines.includes(entry));

    if (missing.length > 0) {
      const toAppend = (content.endsWith('\n') || content === '' ? '' : '\n') +
        `\n# Ever-Brain local cache & state\n` +
        missing.join('\n') +
        '\n';
      fs.appendFileSync(gitignorePath, toAppend, 'utf8');
    }
  }

  getApiUrl(workspaceRoot?: string): string {
    if (process.env.EVB_API_URL || process.env.EVER_BRAIN_API_URL) {
      return process.env.EVB_API_URL || process.env.EVER_BRAIN_API_URL!;
    }
    if (workspaceRoot) {
      try {
        const config = this.readConfig(workspaceRoot);
        if (config.source.api_url) {
          return config.source.api_url;
        }
      } catch {
        // Fall back to default
      }
    }
    return getDefaultApiUrl();
  }
}

export const projectConfigManager = new ProjectConfigManager();
