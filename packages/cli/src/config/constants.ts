import path from 'node:path';
import os from 'node:os';

export const KNOWIKI_DIR = '.knowiki';
export const CONFIG_FILE = 'config.yaml';
export const STATE_FILE = 'state.yaml';
export const AUTH_FILE = 'auth.yaml';
export const CACHE_DIR = 'cache';

export const GLOBAL_KNOWIKI_DIR = path.join(os.homedir(), '.knowiki');
export const GLOBAL_AUTH_FILE = path.join(GLOBAL_KNOWIKI_DIR, 'auth.json');

// Default API URL (can be overridden by KNOWIKI_API_URL or config.yaml)
export const DEFAULT_API_URL = 'http://localhost:3000';

export function getDefaultApiUrl(): string {
  return process.env.KNOWIKI_API_URL || DEFAULT_API_URL;
}

