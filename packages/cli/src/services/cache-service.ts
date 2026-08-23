import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isBinaryOrIgnoredFile } from '@ever-brain/api/utils/binary-filter.js';
import { projectConfigManager } from '../config/project-config.js';

export interface LocalModifications {
  modified: string[];
  added: string[];
  deleted: string[];
  isDirty: boolean;
}

export function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function normalizePosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

export class CacheService {
  readCachedFile(workspaceRoot: string, relativePath: string): string | null {
    const cleanPath = normalizePosixPath(relativePath);
    const fullPath = path.join(projectConfigManager.getCacheDirPath(workspaceRoot), cleanPath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fs.readFileSync(fullPath, 'utf8');
  }

  writeCachedFile(workspaceRoot: string, relativePath: string, content: string): void {
    const cleanPath = normalizePosixPath(relativePath);
    const fullPath = path.join(projectConfigManager.getCacheDirPath(workspaceRoot), cleanPath);
    const dirName = path.dirname(fullPath);

    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf8');
  }

  deleteCachedFile(workspaceRoot: string, relativePath: string): void {
    const cleanPath = normalizePosixPath(relativePath);
    const fullPath = path.join(projectConfigManager.getCacheDirPath(workspaceRoot), cleanPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  listCachedFiles(workspaceRoot: string): string[] {
    const cacheDir = projectConfigManager.getCacheDirPath(workspaceRoot);
    if (!fs.existsSync(cacheDir)) {
      return [];
    }

    const results: string[] = [];

    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const relPath = normalizePosixPath(path.relative(cacheDir, fullPath));
          if (!relPath.startsWith('.') && !relPath.includes('/.')) {
            results.push(relPath);
          }
        }
      }
    };

    walk(cacheDir);
    return results.sort();
  }

  computeDirtyState(workspaceRoot: string): LocalModifications {
    const state = projectConfigManager.readState(workspaceRoot);
    const baselineFiles = state?.files || {};
    const localFiles = this.listCachedFiles(workspaceRoot);

    const localFileSet = new Set(localFiles);
    const baselineFileSet = new Set(Object.keys(baselineFiles));

    const modified: string[] = [];
    const added: string[] = [];
    const deleted: string[] = [];

    // Check existing local files for additions and modifications
    for (const file of localFiles) {
      const content = this.readCachedFile(workspaceRoot, file);
      if (content === null) continue;

      const currentHash = computeSha256(content);

      if (!baselineFileSet.has(file)) {
        added.push(file);
      } else {
        const baselineHash = baselineFiles[file];
        if (currentHash !== baselineHash) {
          modified.push(file);
        }
      }
    }

    // Check for deleted baseline files
    for (const baselineFile of Object.keys(baselineFiles)) {
      if (!localFileSet.has(baselineFile)) {
        deleted.push(baselineFile);
      }
    }

    return {
      modified: modified.sort(),
      added: added.sort(),
      deleted: deleted.sort(),
      isDirty: modified.length > 0 || added.length > 0 || deleted.length > 0,
    };
  }
}

export const cacheService = new CacheService();
