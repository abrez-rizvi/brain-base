import path from 'node:path';
import os from 'node:os';

export const EVB_DIR = '.evb';
export const CONFIG_FILE = 'config.yaml';
export const STATE_FILE = 'state.yaml';
export const AUTH_FILE = 'auth.yaml';
export const CACHE_DIR = 'cache';

export const GLOBAL_EVB_DIR = path.join(os.homedir(), '.evb');
export const GLOBAL_AUTH_FILE = path.join(GLOBAL_EVB_DIR, 'auth.json');

// Default API URL (can be overridden by EVB_API_URL or config.yaml)
export const DEFAULT_API_URL = 'http://localhost:3000';
export const DEFAULT_MCP_URL = 'http://localhost:3001';

export function getDefaultApiUrl(): string {
  return process.env.EVB_API_URL || process.env.EVER_BRAIN_API_URL || DEFAULT_API_URL;
}

export function getDefaultMcpUrl(): string {
  return process.env.EVB_MCP_URL || process.env.EVER_BRAIN_MCP_URL || DEFAULT_MCP_URL;
}

