import path from 'node:path';

export const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.tiff', '.svg',
  // Audio & Video
  '.mp3', '.mp4', '.wav', '.mov', '.avi', '.flac', '.mkv', '.ogg', '.webm', '.aac',
  // Binaries & Compiled Files
  '.zip', '.tar', '.gz', '.tgz', '.7z', '.rar', '.exe', '.dll', '.so', '.dylib',
  '.wasm', '.bin', '.iso', '.dmg', '.pkg', '.obj', '.o', '.a', '.lib',
  // Documents & Presentations
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Fonts
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  // Databases & Lockfiles
  '.sqlite', '.sqlite3', '.db', '.lock',
]);

const BINARY_EXACT_NAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'Cargo.lock',
  'composer.lock',
  'Gemfile.lock',
  'poetry.lock',
]);

export function isBinaryOrIgnoredFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');

  // Exclude .git/ directory contents
  if (normalized.startsWith('.git/') || normalized === '.git') {
    return true;
  }

  const baseName = path.basename(normalized);
  if (BINARY_EXACT_NAMES.has(baseName)) {
    return true;
  }

  const ext = path.extname(normalized).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  return false;
}
