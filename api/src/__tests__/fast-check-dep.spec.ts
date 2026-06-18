/**
 * Source-blind tests for issue #4:
 * chore(api): declare fast-check as an explicit devDependency
 *
 * Tests derived solely from the acceptance criteria (Red phase of TDD).
 * No implementation source was read when authoring these tests.
 *
 * Criteria covered:
 *   [UNIT] api/package.json lists fast-check under devDependencies
 *   [UNIT] api/package-lock.json root packages[""].devDependencies includes fast-check
 *   [UNIT] fast-check is importable as a direct dep (no transitive-hoisting reliance)
 */

import * as fs from 'fs';
import * as path from 'path';

const API_ROOT = path.resolve(__dirname, '../..');

describe('api/package.json', () => {
  let pkg: Record<string, unknown>;

  beforeAll(() => {
    const raw = fs.readFileSync(path.join(API_ROOT, 'package.json'), 'utf-8');
    pkg = JSON.parse(raw) as Record<string, unknown>;
  });

  describe('when devDependencies is inspected, fast-check presence is confirmed', () => {
    it('when devDependencies["fast-check"] is read, the key exists', () => {
      // Criterion: api/package.json lists fast-check under devDependencies
      const devDeps = pkg['devDependencies'] as Record<string, string> | undefined;
      expect(devDeps).toBeDefined();
      expect(devDeps).toHaveProperty('fast-check');
    });

    it('when devDependencies["fast-check"] version is read, it is a ^3.x semver range', () => {
      // Criterion: version matches the lockfile-resolved ^3.x.x family (e.g. ^3.23.1)
      // Choice: any semver range anchored to the ^3. family satisfies the criterion.
      const devDeps = pkg['devDependencies'] as Record<string, string>;
      const version: string = devDeps['fast-check'];
      expect(version).toMatch(/^\^3\./);
    });
  });
});

describe('api/package-lock.json', () => {
  let lockfile: Record<string, unknown>;

  beforeAll(() => {
    const raw = fs.readFileSync(path.join(API_ROOT, 'package-lock.json'), 'utf-8');
    lockfile = JSON.parse(raw) as Record<string, unknown>;
  });

  describe('when the lockfile root package entry is inspected, fast-check sync is confirmed', () => {
    it('when packages[""].devDependencies is read, fast-check is included', () => {
      // Criterion: lockfile root packages[""].devDependencies includes fast-check,
      // keeping package.json and the lockfile in sync.
      const packages = lockfile['packages'] as Record<string, Record<string, unknown>> | undefined;
      expect(packages).toBeDefined();
      const rootEntry = packages![''];
      expect(rootEntry).toBeDefined();
      const devDeps = rootEntry['devDependencies'] as Record<string, string> | undefined;
      expect(devDeps).toBeDefined();
      expect(devDeps).toHaveProperty('fast-check');
    });
  });
});

describe('fast-check module resolution', () => {
  describe('when fast-check is required, it is available as a direct declared dependency', () => {
    it('when fast-check is imported, no error is thrown', () => {
      // Criterion: poi.controller.cache.property.spec.ts no longer depends on
      // transitive hoisting — fast-check must resolve directly.
      // The package.json test above confirms the explicit declaration;
      // this test confirms the runtime module is present and loadable.
      expect(() => require('fast-check')).not.toThrow();
    });

    it('when fast-check is imported, the property-testing API surface is present', () => {
      // Criterion: the spec that uses fast-check still passes — verifying that
      // fc.property and fc.assert are exposed confirms the module is functional.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fc = require('fast-check') as typeof import('fast-check');
      expect(typeof fc.property).toBe('function');
      expect(typeof fc.assert).toBe('function');
    });
  });
});
