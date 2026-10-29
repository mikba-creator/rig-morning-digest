import { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from './reader.js';

export function createDigestApiRoutes(config: RigConfig) {
  const app = new Hono();

  app.get('/:night', (c) => {
    const { night } = c.req.param();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) {
      return c.json({ error: 'Invalid night' }, 400);
    }

    try {
      return c.json(readNight(config.runsDir, night).rows);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return c.json({ error: 'Night not found' }, 404);
      }

      throw error;
    }
  });

  return app;
}
