import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDigestPageRoutes } from '../src/digest/page.js';

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};

describe('digest page', () => {
  it('renders digest fields in job order and highlights retries and failures', async () => {
    const response = await createDigestPageRoutes(config).request('/2026-10-28');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(html.indexOf('digest/render')).toBeLessThan(html.indexOf('fixtures/refresh'));
    expect(html).toContain('<td>—</td>');
    expect(html).toContain('<strong class="warn">3</strong>');
    expect(html).toContain('<td class="warn">fail</td>');
    expect(html).toContain('quota exceeded');
    expect(html).toContain('1 malformed line skipped.');
  });

  it('returns 404 when the night file is missing or the night is invalid', async () => {
    const routes = createDigestPageRoutes(config);

    expect((await routes.request('/2026-10-26')).status).toBe(404);
    expect((await routes.request('/not-a-night')).status).toBe(404);
  });

  it('shows “nothing ran” for an empty night file', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    writeFileSync(join(runsDir, '2026-10-29.jsonl'), '');

    try {
      const response = await createDigestPageRoutes({ ...config, runsDir }).request('/2026-10-29');
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('nothing ran');
      expect(html).not.toContain('<table>');
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });
});
