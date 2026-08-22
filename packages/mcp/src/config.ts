import dotenv from 'dotenv';

dotenv.config();

export interface McpConfig {
  port: number;
  apiUrl: string;
  nodeEnv: string;
}

export const config: McpConfig = {
  port: parseInt(process.env.MCP_PORT || process.env.PORT || '3002', 10),
  apiUrl: process.env.KNOWIKI_API_URL || process.env.API_URL || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',
};
