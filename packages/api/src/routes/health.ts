import { Hono } from 'hono';
import { HealthResponse } from '../types/contract.js';

export const healthRouter = new Hono();

const startTime = Date.now();

healthRouter.get('/', (c) => {
  const uptimeSeconds = Math.round((Date.now() - startTime) / 1000);
  const response: HealthResponse = {
    status: 'ok',
    version: '1.0.0',
    uptimeSeconds,
    timestamp: new Date().toISOString(),
  };
  return c.json(response);
});
