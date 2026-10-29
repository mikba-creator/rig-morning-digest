import { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { lane } from '../lane.js';
import { Layout } from '../views/layout.js';
import { readNight } from './reader.js';
import type { DigestRow } from './types.js';

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function DigestTable(props: { rows: DigestRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Job</th>
          <th>Owner</th>
          <th>Runs</th>
          <th>Retries</th>
          <th>First time</th>
          <th>Last time</th>
          <th>Last status</th>
          <th>Last error</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr>
            <td>{row.job}</td>
            <td>{row.owner ?? '—'}</td>
            <td>{row.runs}</td>
            <td>{row.retries >= 3 ? <strong class="warn">{row.retries}</strong> : row.retries}</td>
            <td>{row.firstTime}</td>
            <td>{row.lastTime}</td>
            <td class={row.lastStatus === 'fail' ? 'warn' : undefined}>{row.lastStatus}</td>
            <td>{row.lastError ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function createDigestPageRoutes(config: RigConfig) {
  const app = new Hono();

  app.get('/:night', (c) => {
    const night = c.req.param('night');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return c.notFound();

    let digest;
    try {
      digest = readNight(config.runsDir, night);
    } catch (error) {
      if (isMissingFile(error)) return c.notFound();
      throw error;
    }

    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <h1>Digest · {night}</h1>
        {digest.rows.length > 0 ? (
          <DigestTable rows={digest.rows} />
        ) : digest.malformedLines === 0 ? (
          <p>nothing ran</p>
        ) : (
          <p>No valid runs.</p>
        )}
        {digest.malformedLines > 0 && (
          <p class="mute">
            {digest.malformedLines} malformed {digest.malformedLines === 1 ? 'line' : 'lines'} skipped.
          </p>
        )}
      </Layout>,
    );
  });

  return app;
}
