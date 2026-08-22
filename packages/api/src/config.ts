import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  githubToken?: string;
  cacheTtlMs: number;
  nodeEnv: string;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  githubToken: process.env.GITHUB_TOKEN || undefined,
  cacheTtlMs: parseInt(process.env.CACHE_TTL_MS || '60000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
};
