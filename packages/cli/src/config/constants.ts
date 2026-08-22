import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import dotenv from 'dotenv';

// Load .env from current directory
dotenv.config();

export const EVB_DIR = '.evb';
export const CONFIG_FILE = 'config.yaml';
export const STATE_FILE = 'state.yaml';
export const AUTH_FILE = 'auth.yaml';
export const CACHE_DIR = 'cache';

export const GLOBAL_EVB_DIR = path.join(os.homedir(), '.evb');
export const GLOBAL_AUTH_FILE = path.join(GLOBAL_EVB_DIR, 'auth.json');
export const GLOBAL_ENV_FILE = path.join(GLOBAL_EVB_DIR, '.env');

// Also load ~/.evb/.env if present
if (fs.existsSync(GLOBAL_ENV_FILE)) {
  dotenv.config({ path: GLOBAL_ENV_FILE });
}

// Default API and MCP URLs (live Hugging Face Space by default, overridable by env/flags)
export const DEFAULT_API_URL = 'https://projectsorg-ever-brain.hf.space';
export const DEFAULT_MCP_URL = 'https://projectsorg-ever-brain.hf.space';

export function getDefaultApiUrl(): string {
  return process.env.EVB_API_URL || process.env.EVER_BRAIN_API_URL || DEFAULT_API_URL;
}

export function getDefaultMcpUrl(): string {
  return process.env.EVB_MCP_URL || process.env.EVER_BRAIN_MCP_URL || DEFAULT_MCP_URL;
}

