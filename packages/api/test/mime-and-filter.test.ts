import { describe, it, expect } from 'vitest';
import { resolveMimeType } from '../src/utils/mime.js';
import { isBinaryOrIgnoredFile } from '../src/utils/binary-filter.js';

describe('MIME Type Resolution', () => {
  it('resolves markdown files correctly', () => {
    expect(resolveMimeType('README.md')).toBe('text/markdown');
    expect(resolveMimeType('knowledge/architecture.markdown')).toBe('text/markdown');
    expect(resolveMimeType('skills/guide.mdx')).toBe('text/markdown');
  });

  it('resolves source code files', () => {
    expect(resolveMimeType('src/index.ts')).toBe('text/typescript');
    expect(resolveMimeType('src/app.js')).toBe('text/javascript');
    expect(resolveMimeType('config.json')).toBe('application/json');
    expect(resolveMimeType('config.yaml')).toBe('text/yaml');
    expect(resolveMimeType('main.py')).toBe('text/x-python');
    expect(resolveMimeType('main.rs')).toBe('text/x-rust');
    expect(resolveMimeType('main.go')).toBe('text/x-go');
  });

  it('resolves special exact filenames', () => {
    expect(resolveMimeType('LICENSE')).toBe('text/plain');
    expect(resolveMimeType('LICENSE.md')).toBe('text/markdown');
    expect(resolveMimeType('Makefile')).toBe('text/plain');
    expect(resolveMimeType('Dockerfile')).toBe('text/plain');
  });

  it('defaults unknown extensions to text/plain', () => {
    expect(resolveMimeType('random.unknownxyz')).toBe('text/plain');
  });
});

describe('Binary & Git Exclusion Filter', () => {
  it('excludes .git/ directory contents', () => {
    expect(isBinaryOrIgnoredFile('.git/config')).toBe(true);
    expect(isBinaryOrIgnoredFile('.git/HEAD')).toBe(true);
    expect(isBinaryOrIgnoredFile('.git/objects/abc')).toBe(true);
  });

  it('excludes binary image and media formats', () => {
    expect(isBinaryOrIgnoredFile('assets/logo.png')).toBe(true);
    expect(isBinaryOrIgnoredFile('assets/image.jpg')).toBe(true);
    expect(isBinaryOrIgnoredFile('audio/sound.mp3')).toBe(true);
    expect(isBinaryOrIgnoredFile('video/intro.mp4')).toBe(true);
    expect(isBinaryOrIgnoredFile('icons/favicon.ico')).toBe(true);
  });

  it('excludes archives and compiled binaries', () => {
    expect(isBinaryOrIgnoredFile('bundle.zip')).toBe(true);
    expect(isBinaryOrIgnoredFile('archive.tar.gz')).toBe(true);
    expect(isBinaryOrIgnoredFile('program.exe')).toBe(true);
    expect(isBinaryOrIgnoredFile('module.wasm')).toBe(true);
    expect(isBinaryOrIgnoredFile('db.sqlite')).toBe(true);
  });

  it('excludes standard package manager lockfiles', () => {
    expect(isBinaryOrIgnoredFile('package-lock.json')).toBe(true);
    expect(isBinaryOrIgnoredFile('pnpm-lock.yaml')).toBe(true);
    expect(isBinaryOrIgnoredFile('yarn.lock')).toBe(true);
    expect(isBinaryOrIgnoredFile('Cargo.lock')).toBe(true);
  });

  it('allows textual files and markdown', () => {
    expect(isBinaryOrIgnoredFile('README.md')).toBe(false);
    expect(isBinaryOrIgnoredFile('knowledge/architecture.md')).toBe(false);
    expect(isBinaryOrIgnoredFile('skills/testing/SKILL.md')).toBe(false);
    expect(isBinaryOrIgnoredFile('src/index.ts')).toBe(false);
    expect(isBinaryOrIgnoredFile('package.json')).toBe(false);
  });
});
