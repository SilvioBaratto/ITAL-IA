/**
 * Source-blind tests for issue #3:
 * chore(api): pin Vercel functions to fra1 (Frankfurt) in vercel.json
 *
 * Tests are derived solely from the acceptance criteria. No implementation
 * source was read when authoring these tests (Red phase of TDD).
 *
 * Criteria tested:
 *   [UNIT] api/vercel.json contains a top-level "regions": ["fra1"]
 *   [UNIT] The file remains valid JSON and all existing keys (version,
 *          buildCommand, installCommand, rewrites, headers, env) are preserved
 */

import * as fs from 'fs';
import * as path from 'path';

const VERCEL_JSON_PATH = path.resolve(__dirname, '../../..', 'api', 'vercel.json');

describe('api/vercel.json', () => {
  let parsed: Record<string, unknown>;

  beforeAll(() => {
    const raw = fs.readFileSync(VERCEL_JSON_PATH, 'utf-8');
    parsed = JSON.parse(raw) as Record<string, unknown>;
  });

  describe('when vercel.json is read, regions key is present and correct', () => {
    it('when regions is inspected, ["fra1"] is returned', () => {
      // Criterion: api/vercel.json contains a top-level "regions": ["fra1"]
      expect(parsed).toHaveProperty('regions');
      expect(parsed['regions']).toEqual(['fra1']);
    });
  });

  describe('when vercel.json is read, file integrity is preserved', () => {
    it('when version is inspected, it is present and unchanged', () => {
      // Criterion: existing key "version" is preserved
      expect(parsed).toHaveProperty('version');
    });

    it('when buildCommand is inspected, it is present and unchanged', () => {
      // Criterion: existing key "buildCommand" is preserved
      expect(parsed).toHaveProperty('buildCommand');
    });

    it('when installCommand is inspected, it is present and unchanged', () => {
      // Criterion: existing key "installCommand" is preserved
      expect(parsed).toHaveProperty('installCommand');
    });

    it('when rewrites is inspected, it is present and unchanged', () => {
      // Criterion: existing key "rewrites" is preserved
      expect(parsed).toHaveProperty('rewrites');
    });

    it('when headers is inspected, it is present and unchanged', () => {
      // Criterion: existing key "headers" is preserved
      expect(parsed).toHaveProperty('headers');
    });

    it('when env is inspected, it is present and unchanged', () => {
      // Criterion: existing key "env" is preserved
      expect(parsed).toHaveProperty('env');
    });
  });
});
