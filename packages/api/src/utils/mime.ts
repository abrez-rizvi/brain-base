import path from 'node:path';

export const MIME_MAP: Record<string, string> = {
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.mdx': 'text/markdown',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.mts': 'text/typescript',
  '.cts': 'text/typescript',
  '.js': 'text/javascript',
  '.jsx': 'text/javascript',
  '.mjs': 'text/javascript',
  '.cjs': 'text/javascript',
  '.json': 'application/json',
  '.json5': 'application/json',
  '.jsonc': 'application/json',
  '.py': 'text/x-python',
  '.pyi': 'text/x-python',
  '.rs': 'text/x-rust',
  '.go': 'text/x-go',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.scss': 'text/css',
  '.sass': 'text/css',
  '.less': 'text/css',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.toml': 'text/x-toml',
  '.xml': 'application/xml',
  '.sh': 'text/x-shellscript',
  '.bash': 'text/x-shellscript',
  '.zsh': 'text/x-shellscript',
  '.ps1': 'text/x-shellscript',
  '.txt': 'text/plain',
  '.sql': 'text/x-sql',
  '.graphql': 'text/plain',
  '.gql': 'text/plain',
  '.prisma': 'text/plain',
};

const EXACT_FILE_MIME_MAP: Record<string, string> = {
  'LICENSE': 'text/plain',
  'LICENSE.md': 'text/markdown',
  'LICENSE.txt': 'text/plain',
  'Makefile': 'text/plain',
  'Dockerfile': 'text/plain',
  'Containerfile': 'text/plain',
  '.env.example': 'text/plain',
};

export function resolveMimeType(filePath: string): string {
  const baseName = path.basename(filePath);
  if (EXACT_FILE_MIME_MAP[baseName]) {
    return EXACT_FILE_MIME_MAP[baseName];
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext && MIME_MAP[ext]) {
    return MIME_MAP[ext];
  }

  return 'text/plain';
}
