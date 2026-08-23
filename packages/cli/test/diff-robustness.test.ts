import { describe, it, expect, vi } from 'vitest';
import { isBinaryContent, normalizeCrlf } from '../src/commands/diff.js';
import { emitTelemetry } from '../src/utils/telemetry.js';

describe('Diff Robustness & Edge-Case Utilities', () => {
  it('isBinaryContent should identify binary file extensions', () => {
    expect(isBinaryContent('some text', 'image.png')).toBe(true);
    expect(isBinaryContent('some text', 'document.pdf')).toBe(true);
    expect(isBinaryContent('some text', 'archive.zip')).toBe(true);
    expect(isBinaryContent('some text', 'binary.wasm')).toBe(true);
    expect(isBinaryContent('# Title', 'knowledge/arch.md')).toBe(false);
    expect(isBinaryContent('{"key":"value"}', 'config.json')).toBe(false);
  });

  it('isBinaryContent should identify null bytes in raw buffers', () => {
    const textWithNull = 'Hello\0World';
    expect(isBinaryContent(textWithNull, 'unknown.dat')).toBe(true);
  });

  it('normalizeCrlf should convert CRLF line endings to LF without content corruption', () => {
    const crlfText = 'line1\r\nline2\r\nline3\r\n';
    const normalized = normalizeCrlf(crlfText);
    expect(normalized).toBe('line1\nline2\nline3\n');
    expect(normalized.includes('\r')).toBe(false);
  });

  it('emitTelemetry should execute non-blockingly and isolate failures', async () => {
    // Should never throw even if API URL is unreachable or offline
    await expect(
      emitTelemetry({
        type: 'sync',
        command: 'sync',
        message: 'testing telemetry offline resilience',
      })
    ).resolves.not.toThrow();
  });
});
