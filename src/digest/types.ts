export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  firstTime: string;
  lastTime: string;
  lastStatus: DigestStatus;
  lastError: string | null;
};

export type NightRead = {
  rows: DigestRow[];
  malformedLines: number;
};

// Signature implemented by the run-log reader.
export type ReadNight = (runsDir: string, night: string) => NightRead;
