/**
 * Source-blind example tests for issue #2 (s-maxage edge caching).
 * Derived solely from acceptance criteria — no implementation source was read.
 *
 * Assumptions:
 *   - RegionController lives in ./region.controller
 *   - RegionService lives in ./region.service (used as the DI token)
 *   - The controller route prefix resolves to 'regions' (no global prefix in unit tests)
 *
 * Criteria under test (UNIT tier, from oracle report):
 *   1. Region endpoints set Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800
 *   2. No private, no-cache, or no-store directive on region endpoints
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { RegionController } from './region.controller';
import { RegionService } from './region.service';

const REGION_CACHE_CONTROL =
  'public, s-maxage=86400, stale-while-revalidate=604800';

/**
 * Returns a Proxy that satisfies any service interface by returning a resolved
 * empty-array Promise for every method access. Source-blind: we cannot read the
 * service interface, so we do not enumerate its methods.
 */
function anyMethodProxy(): unknown {
  return new Proxy(
    {},
    {
      get: (_target, prop) =>
        prop === 'then' ? undefined : jest.fn().mockResolvedValue([]),
    },
  );
}

describe('RegionController – Cache-Control header (issue #2)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegionController],
      providers: [{ provide: RegionService, useValue: anyMethodProxy() }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  it('when GET /regions is called, Cache-Control header is "public, s-maxage=86400, stale-while-revalidate=604800"', async () => {
    const res = await request(app.getHttpServer()).get('/regions');
    expect(res.headers['cache-control']).toBe(REGION_CACHE_CONTROL);
  });

  it('when GET /regions is called, Cache-Control header contains no private, no-cache, or no-store directive', async () => {
    const res = await request(app.getHttpServer()).get('/regions');
    const cc = (res.headers['cache-control'] ?? '') as string;
    expect(cc).not.toMatch(/\bprivate\b/);
    expect(cc).not.toMatch(/\bno-cache\b/);
    expect(cc).not.toMatch(/\bno-store\b/);
  });
});
