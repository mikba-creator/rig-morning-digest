import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightRead, ReadNight } from './types.js';

type RunRecord = {
  at: string;
  atMillis: number;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error: string | null;
};

type AggregatedRow = {
  row: DigestRow;
  firstMillis: number;
  lastMillis: number;
};

const statuses = new Set<DigestStatus>(['ok', 'retry', 'fail']);

function parseRecord(line: string): RunRecord | null {
  let value: unknown;
  try {
    value = JSON.parse(line) as unknown;
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const atMillis = typeof record.at === 'string' ? Date.parse(record.at) : Number.NaN;
  if (
    !Number.isFinite(atMillis) ||
    typeof record.job !== 'string' ||
    record.job.length === 0 ||
    typeof record.status !== 'string' ||
    !statuses.has(record.status as DigestStatus) ||
    (typeof record.owner !== 'string' && record.owner !== null) ||
    (record.error !== undefined && typeof record.error !== 'string')
  ) {
    return null;
  }

  return {
    at: record.at as string,
    atMillis,
    job: record.job,
    status: record.status as DigestStatus,
    owner: record.owner,
    error: typeof record.error === 'string' ? record.error : null,
  };
}

function readLines(contents: string): string[] {
  if (contents.length === 0) return [];
  const lines = contents.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

export const readNight: ReadNight = (runsDir, night): NightRead => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) {
    throw new TypeError(`Invalid night: ${night}`);
  }

  const contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const jobs = new Map<string, AggregatedRow>();
  let malformedLines = 0;

  for (const line of readLines(contents)) {
    const record = parseRecord(line);
    if (!record) {
      malformedLines += 1;
      continue;
    }

    const existing = jobs.get(record.job);
    if (!existing) {
      jobs.set(record.job, {
        row: {
          job: record.job,
          owner: record.owner,
          runs: record.status === 'retry' ? 0 : 1,
          retries: record.status === 'retry' ? 1 : 0,
          firstTime: record.at,
          lastTime: record.at,
          lastStatus: record.status,
          lastError: record.error,
        },
        firstMillis: record.atMillis,
        lastMillis: record.atMillis,
      });
      continue;
    }

    if (record.status === 'retry') existing.row.retries += 1;
    else existing.row.runs += 1;

    if (record.atMillis < existing.firstMillis) {
      existing.firstMillis = record.atMillis;
      existing.row.firstTime = record.at;
    }
    if (record.atMillis >= existing.lastMillis) {
      existing.lastMillis = record.atMillis;
      existing.row.lastTime = record.at;
      existing.row.lastStatus = record.status;
      existing.row.lastError = record.error;
    }
  }

  return {
    rows: [...jobs.values()].map(({ row }) => row).sort((a, b) => a.job.localeCompare(b.job)),
    malformedLines,
  };
};
