import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/reader.js';

const night = '2026-10-28';
const endpoints = [
  { path: `/digest/${night}`, api: false },
  { path: `/api/digest/${night}`, api: true },
] as const;

let runsDir: string;

beforeEach(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

function app() {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

describe.each(endpoints)('$path', ({ path, api }) => {
  it('returns a successful digest for a night with runs', async () => {
    writeFileSync(
      join(runsDir, `${night}.jsonl`),
      [
        JSON.stringify({
          at: '2026-10-29T02:00:00+01:00',
          job: 'zeta/job',
          status: 'ok',
          owner: 'rook',
        }),
        JSON.stringify({
          at: '2026-10-29T01:00:00+01:00',
          job: 'alpha/job',
          status: 'fail',
          owner: null,
          error: 'quota exceeded',
        }),
      ].join('\n'),
    );

    const response = await app().request(path);

    expect(response.status).toBe(200);
    if (api) {
      expect(await response.json()).toEqual(readNight(runsDir, night).rows);
    } else {
      const html = await response.text();
      expect(html).toContain('alpha/job');
      expect(html).toContain('zeta/job');
    }
  });

  it('returns 404 when the night file is missing', async () => {
    const response = await app().request(path);

    expect(response.status).toBe(404);
  });

  it('handles an empty night file', async () => {
    writeFileSync(join(runsDir, `${night}.jsonl`), '');

    const response = await app().request(path);

    expect(response.status).toBe(200);
    if (api) {
      expect(await response.json()).toEqual([]);
    } else {
      expect(await response.text()).toContain('nothing ran');
    }
  });

  it('ignores malformed lines and returns the valid rows', async () => {
    writeFileSync(
      join(runsDir, `${night}.jsonl`),
      [
        'not-json',
        JSON.stringify({
          at: '2026-10-29T01:00:00+01:00',
          job: 'valid/job',
          status: 'ok',
          owner: null,
        }),
      ].join('\n'),
    );

    const response = await app().request(path);

    expect(response.status).toBe(200);
    if (api) {
      expect(await response.json()).toEqual(readNight(runsDir, night).rows);
    } else {
      const html = await response.text();
      expect(html).toContain('valid/job');
      expect(html).not.toContain('not-json');
    }
  });
});
