import { SearchMatch, SearchResponse } from '../types/contract.js';
import { logger } from '../utils/logger.js';
import { githubService } from './github-service.js';
import { resolverService } from './resolver-service.js';

export class SearchService {
  async search(
    owner: string,
    repo: string,
    query: string,
    branch?: string,
    prefix?: string
  ): Promise<SearchResponse> {
    const startTime = performance.now();
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return {
        query: '',
        totalMatches: 0,
        results: [],
      };
    }

    const tree = await resolverService.getOrDiscoverFiles(owner, repo, branch, false, prefix);
    const targetBranch = tree.branch;
    const lowerQuery = cleanQuery.toLowerCase();

    // Filter candidate files to search (Markdown, text, code)
    const candidateFiles = tree.files.filter((f) => {
      return (
        f.mimeType.startsWith('text/') ||
        f.mimeType === 'application/json' ||
        f.mimeType === 'application/xml' ||
        f.mimeType === 'text/yaml'
      );
    });

    const results: SearchMatch[] = [];
    const concurrency = 10;

    // Process files in concurrency batches
    for (let i = 0; i < candidateFiles.length; i += concurrency) {
      const batch = candidateFiles.slice(i, i + concurrency);
      const batchPromises = batch.map(async (file) => {
        try {
          const res = await githubService.getRawFileContent(
            owner,
            repo,
            targetBranch,
            file.path
          );

          if (res.status === 200 && res.content) {
            const lines = res.content.split('\n');
            const matchingLines: number[] = [];
            let matchCount = 0;

            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
              const lineLower = lines[lineIndex].toLowerCase();
              if (lineLower.includes(lowerQuery)) {
                matchingLines.push(lineIndex + 1);
                // Count occurrences in line
                let pos = 0;
                while ((pos = lineLower.indexOf(lowerQuery, pos)) !== -1) {
                  matchCount++;
                  pos += lowerQuery.length;
                }
              }
            }

            if (matchCount > 0) {
              return {
                path: file.path,
                matches: matchCount,
                lines: matchingLines,
              };
            }
          }
        } catch {
          // Ignore individual read errors during search
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      for (const res of batchResults) {
        if (res) {
          results.push(res);
        }
      }
    }

    // Sort by matches descending
    results.sort((a, b) => b.matches - a.matches);

    const totalMatches = results.reduce((acc, r) => acc + r.matches, 0);
    const durationMs = Math.round(performance.now() - startTime);

    logger.search(cleanQuery, totalMatches, durationMs);

    return {
      query: cleanQuery,
      totalMatches,
      results,
    };
  }
}

export const searchService = new SearchService();
