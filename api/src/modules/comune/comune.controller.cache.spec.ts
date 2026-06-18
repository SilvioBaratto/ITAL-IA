/**
 * Source-blind example tests for issue #2 (s-maxage edge caching).
 * Derived solely from acceptance criteria — no implementation source was read.
 *
 * Assumptions:
 *   - ComuneController lives in ./comune.controller
 *   - ComuneService lives in ./comune.service (used as the DI token)
 *   - The controller route prefix resolves to 'comuni' (no global prefix in unit tests)
 *
 * Criteria under test (UNIT tier, from oracle report):
 *   1. Comune endpoints set Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800
 *   2. No private, no-cache, or no-store directive on comune endpoints
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { ComuneController } from './comune.controller';
import { ComuneService } from './comune.service';

const COMUNE_CACHE_CONTROL =
  'public, s-maxage=86400, stale-while-revalidate=604800';

function anyMethodProxy(): unknown {
  return new Proxy(
    {},
    {
      get: (_target, prop) =>
        prop === 'then' ? undefined : jest.fn().mockResolvedValue([]),
    },
  );
}

describe('ComuneController – Cache-Control header (issue #2)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComuneController],
      providers: [{ provide: ComuneService, useValue: anyMethodProxy() }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  it('when GET /comuni is called, Cache-Control header is "public, s-maxage=86400, stale-while-revalidate=604800"', async () => {
    const res = await request(app.getHttpServer()).get('/comuni');
    expect(res.headers['cache-control']).toBe(COMUNE_CACHE_CONTROL);
  });

  it('when GET /comuni is called, Cache-Control header contains no private, no-cache, or no-store directive', async () => {
    const res = await request(app.getHttpServer()).get('/comuni');
    const cc = (res.headers['cache-control'] ?? '') as string;
    expect(cc).not.toMatch(/\bprivate\b/);
    expect(cc).not.toMatch(/\bno-cache\b/);
    expect(cc).not.toMatch(/\bno-store\b/);
  });
});
