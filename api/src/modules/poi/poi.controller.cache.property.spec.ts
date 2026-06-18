/**
 * Source-blind property-based tests for issue #2 (s-maxage edge caching).
 * Derived solely from acceptance criteria — no implementation source was read.
 *
 * Invariant from criterion: "No private, no-cache, or no-store directive on these endpoints"
 * This must hold for ALL valid query-parameter combinations, not just the zero-params case.
 *
 * Requires fast-check: npm install --save-dev fast-check
 *
 * POI endpoint accepts at least: region (string slug) and category (string enum).
 * Source of categories: 13 categories documented in CLAUDE.md (poi module description).
 */

import * as fc from 'fast-check';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { PoiController } from './poi.controller';
import { PoiService } from './poi.service';

const FORBIDDEN_DIRECTIVES = [/\bprivate\b/, /\bno-cache\b/, /\bno-store\b/];

/** 13 POI categories listed in CLAUDE.md */
const POI_CATEGORIES = [
  'RESTAURANT',
  'HOTEL',
  'MUSEUM',
  'PARK',
  'BEACH',
  'CASTLE',
  'CHURCH',
  'WINERY',
  'SHOP',
  'FESTIVAL',
  'MONUMENT',
  'TRAIL',
  'VIEWPOINT',
] as const;

/** Region slugs are lowercase-hyphenated; we use printable ASCII letters+hyphens. */
const regionSlugArb = fc.stringMatching(/^[a-z][a-z-]{0,30}$/);

/** Optional category — some requests include none. */
const categoryArb = fc.option(fc.constantFrom(...POI_CATEGORIES), {
  nil: undefined,
});

function anyMethodProxy(): unknown {
  return new Proxy(
    {},
    {
      get: (_target, prop) =>
        prop === 'then' ? undefined : jest.fn().mockResolvedValue([]),
    },
  );
}

describe('PoiController – no forbidden Cache-Control directives for any query params (property, issue #2)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PoiController],
      providers: [{ provide: PoiService, useValue: anyMethodProxy() }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  /**
   * Property: for any valid combination of region slug and optional category,
   * the Cache-Control header never contains private, no-cache, or no-store.
   *
   * Invariant kind: never-raises-for-valid-input (extended to "a header invariant
   * that holds for all valid inputs to the endpoint").
   */
  it('when GET /poi is called with any valid query params, Cache-Control never contains private, no-cache, or no-store', async () => {
    await fc.assert(
      fc.asyncProperty(regionSlugArb, categoryArb, async (region, category) => {
        const query: Record<string, string> = { region };
        if (category !== undefined) query['category'] = category;

        const res = await request(app.getHttpServer())
          .get('/poi')
          .query(query);

        const cc = (res.headers['cache-control'] ?? '') as string;

        for (const pattern of FORBIDDEN_DIRECTIVES) {
          expect(cc).not.toMatch(pattern);
        }
      }),
      { numRuns: 20 },
    );
  });
});
