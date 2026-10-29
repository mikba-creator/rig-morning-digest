import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('run log reader', () => {
  it('aggregates the example night and counts its malformed line', () => {
    const result = readNight('runs', '2026-10-28');

    expect(result.rows).toHaveLength(5);
    expect(result.malformedLines).toBe(1);
    expect(result.rows.map(({ job }) => job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);

    expect(result.rows.find(({ job }) => job === 'fixtures/refresh')).toMatchObject({
      owner: 'rook',
      runs: 1,
      retries: 3,
      firstTime: '2026-10-29T01:30:00+01:00',
      lastTime: '2026-10-29T01:37:00+01:00',
      lastStatus: 'ok',
      lastError: null,
    });
    expect(result.rows.find(({ job }) => job === 'lane/sync')).toMatchObject({
      runs: 7,
      retries: 2,
      lastStatus: 'ok',
      lastError: null,
    });
    expect(result.rows.find(({ job }) => job === 'notes/backup')).toMatchObject({
      runs: 1,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });

  it('preserves null owners and keeps the timestamp offset', () => {
    const { rows } = readNight('runs', '2026-10-28');

    expect(rows.find(({ job }) => job === 'digest/render')).toMatchObject({
      owner: null,
      runs: 1,
      retries: 0,
      firstTime: '2026-10-29T05:41:09+01:00',
      lastTime: '2026-10-29T05:41:09+01:00',
      lastStatus: 'ok',
      lastError: null,
    });
  });
});
