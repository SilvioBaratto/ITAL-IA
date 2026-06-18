/**
 * Source-blind example tests for issue #2 (s-maxage edge caching).
 * Derived solely from acceptance criteria — no implementation source was read.
 *
 * Assumptions:
 *   - PoiController lives in ./poi.controller
 *   - PoiService lives in ./poi.service (used as the DI token)
 *   - The controller route prefix resolves to 'poi' (no global prefix in unit tests)
 *
 * Criteria under test (UNIT tier, from oracle report):
 *   1. POI endpoints set Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
 *   2. No private, no-cache, or no-store directive on poi endpoints
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { PoiController } from './poi.controller';
import { PoiService } from './poi.service';

const POI_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400';

function anyMethodProxy(): unknown {
  return new Proxy(
    {},
    {
      get: (_target, prop) =>
        prop === 'then' ? undefined : jest.fn().mockResolvedValue([]),
    },
  );
}

describe('PoiController – Cache-Control header (issue #2)', () => {
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

  it('when GET /poi is called, Cache-Control header is "public, s-maxage=3600, stale-while-revalidate=86400"', async () => {
    const res = await request(app.getHttpServer()).get('/poi');
    expect(res.headers['cache-control']).toBe(POI_CACHE_CONTROL);
  });

  it('when GET /poi is called, Cache-Control header contains no private, no-cache, or no-store directive', async () => {
    const res = await request(app.getHttpServer()).get('/poi');
    const cc = (res.headers['cache-control'] ?? '') as string;
    expect(cc).not.toMatch(/\bprivate\b/);
    expect(cc).not.toMatch(/\bno-cache\b/);
    expect(cc).not.toMatch(/\bno-store\b/);
  });
});
