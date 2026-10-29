import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import type { RigConfig } from '../src/config.js';
import { createDigestApiRoutes } from '../src/digest/api.js';

const directories: string[] = [];

function createRunsDir(): string {
  const directory = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));
  directories.push(directory);
  return directory;
}

function createApp(runsDir: string): Hono {
  const config: RigConfig = {
    adapter: 'test',
    installed: 'test',
    beatEverySeconds: 60,
    runsDir,
  };
  const app = new Hono();
  app.route('/api/digest', createDigestApiRoutes(config));
  return app;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('digest JSON API', () => {
  it('returns sorted rows as JSON and ignores malformed lines', async () => {
    const runsDir = createRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      [
        JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: 'zeta', status: 'ok', owner: null }),
        'not json',
        JSON.stringify({ at: '2026-10-28T01:01:00+01:00', job: 'alpha', status: 'fail', owner: 'rook', error: 'failed' }),
      ].join('\n'),
    );
    const response = await createApp(runsDir).request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual([
      {
        job: 'alpha',
        owner: 'rook',
        runs: 1,
        retries: 0,
        firstTime: '2026-10-28T01:01:00+01:00',
        lastTime: '2026-10-28T01:01:00+01:00',
        lastStatus: 'fail',
        lastError: 'failed',
      },
      {
        job: 'zeta',
        owner: null,
        runs: 1,
        retries: 0,
        firstTime: '2026-10-28T01:00:00+01:00',
        lastTime: '2026-10-28T01:00:00+01:00',
        lastStatus: 'ok',
        lastError: null,
      },
    ]);
  });

  it('returns an empty array for an empty night file', async () => {
    const runsDir = createRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');

    const response = await createApp(runsDir).request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('returns 404 when the night file is missing', async () => {
    const response = await createApp(createRunsDir()).request('/api/digest/2026-10-28');

    expect(response.status).toBe(404);
  });

  it('rejects malformed night identifiers', async () => {
    const response = await createApp(createRunsDir()).request('/api/digest/not-a-night');

    expect(response.status).toBe(400);
  });
});
