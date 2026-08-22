import { serve } from '@hono/node-server';
import { app } from './app.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    logger.info('Server', `Knowiki API running on http://localhost:${info.port}`);
    logger.info('Server', `Environment: ${config.nodeEnv}`);
    if (config.githubToken) {
      logger.info('GitHub Auth', 'GITHUB_TOKEN loaded (5,000 req/hr rate limit enabled)');
    } else {
      logger.info('GitHub Auth', 'Anonymous mode (60 req/hr rate limit)');
    }
  }
);

// Graceful shutdown handling
const shutdown = () => {
  logger.info('Server', 'Shutting down Knowiki API gracefully...');
  server.close(() => {
    logger.info('Server', 'Knowiki API stopped.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app };
