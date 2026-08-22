import pc from 'picocolors';
import { projectConfigManager } from '../config/project-config.js';
import { cacheService, normalizePosixPath } from '../services/cache-service.js';
import { logger } from '../utils/logger.js';
import { outputResult, outputError, OutputOptions } from '../utils/output.js';

export async function handleKnowledgeList(options: OutputOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findKnowikiRoot();
  if (!workspaceRoot) {
    return outputError('Not inside a Knowiki project. Run `knowiki init <repo>` first.', 'NOT_IN_WORKSPACE', options);
  }

  try {
    const allFiles = cacheService.listCachedFiles(workspaceRoot);
    const knowledgeFiles = allFiles.filter((f) => f.startsWith('knowledge/') || f.endsWith('.md'));

    const items = knowledgeFiles.map((file) => {
      const content = cacheService.readCachedFile(workspaceRoot, file) || '';
      const lines = content.split('\n');
      const firstHeader = lines.find((l) => l.startsWith('#'))?.replace(/^#+\s*/, '') || '';
      return {
        path: file,
        title: firstHeader || file,
        sizeBytes: Buffer.byteLength(content, 'utf8'),
      };
    });

    outputResult({ documents: items, total: items.length }, options, () => {
      if (items.length === 0) {
        console.log(pc.yellow('No knowledge documents found in cache. Run `knowiki sync` to update.'));
        return;
      }

      console.log(pc.bold(pc.cyan(`\nKnowledge Documents (${items.length}):`)));
      for (const item of items) {
        console.log(`  • ${pc.bold(pc.white(item.path))} ${item.title !== item.path ? pc.dim(`— ${item.title}`) : ''}`);
      }
      console.log(pc.dim(`\nTip: Use 'knowiki knowledge show <path>' to view a document.`));
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'KNOWLEDGE_ERROR', options);
  }
}

export async function handleKnowledgeShow(docPath: string, options: OutputOptions = {}): Promise<void> {
  const workspaceRoot = projectConfigManager.findKnowikiRoot();
  if (!workspaceRoot) {
    return outputError('Not inside a Knowiki project. Run `knowiki init <repo>` first.', 'NOT_IN_WORKSPACE', options);
  }

  try {
    const cleanPath = normalizePosixPath(docPath);
    let content = cacheService.readCachedFile(workspaceRoot, cleanPath);

    // Try prepending knowledge/ if not found directly
    if (content === null && !cleanPath.startsWith('knowledge/')) {
      content = cacheService.readCachedFile(workspaceRoot, `knowledge/${cleanPath}`);
    }

    if (content === null) {
      return outputError(`Knowledge document '${docPath}' not found in cache.`, 'DOC_NOT_FOUND', options);
    }

    outputResult({ path: cleanPath, content }, options, () => {
      console.log(content);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(message, 'KNOWLEDGE_SHOW_ERROR', options);
  }
}
