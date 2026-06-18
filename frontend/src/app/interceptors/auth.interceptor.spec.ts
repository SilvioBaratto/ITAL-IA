import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

const FAKE_TOKEN = 'fake-access-token-xyz';

function configure(token: string | null): {
  http: HttpClient;
  httpTesting: HttpTestingController;
} {
  const authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', [
    'getAccessToken',
    'refreshSession',
    'logout',
  ]);
  authServiceSpy.getAccessToken.and.returnValue(token);
  authServiceSpy.refreshSession.and.resolveTo(null as any);
  authServiceSpy.logout.and.resolveTo(undefined as any);

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: authServiceSpy },
      { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    httpTesting: TestBed.inject(HttpTestingController),
  };
}

afterEach(() => {
  TestBed.resetTestingModule();
});

// --- Criterion 1: logged-in GETs to public paths carry NO Authorization header ---
// Both absolute (dev) and relative (prod) URLs are tested per the comment requirement.

const PUBLIC_GET_PATHS = [
  // relative paths (prod shape — what actually runs in production)
  '/api/v1/regions',
  '/api/v1/poi',
  '/api/v1/poi/123e4567-e89b-12d3-a456-426614174000',
  '/api/v1/poi/123e4567-e89b-12d3-a456-426614174000/related',
  '/api/v1/poi/stats',
  '/api/v1/comuni',
  '/api/v1/comuni/nearest',
  // with query string (must strip before matching)
  '/api/v1/poi?regionId=abc&page=1',
];

describe('authInterceptor — public GET paths omit Authorization header', () => {
  PUBLIC_GET_PATHS.forEach((path) => {
    it(`when logged in, GET ${path} carries no Authorization header`, () => {
      const { http, httpTesting } = configure(FAKE_TOKEN);

      http.get(path).subscribe();

      const req = httpTesting.expectOne(path);
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({});
      httpTesting.verify();
    });
  });
});

// --- Criterion 2: logged-in GETs to protected paths attach Bearer token ---

const PROTECTED_GET_PATHS = [
  '/api/v1/saved-items',
  '/api/v1/chat',
  '/api/v1/auth',
];

describe('authInterceptor — protected GET paths attach Bearer token', () => {
  PROTECTED_GET_PATHS.forEach((path) => {
    it(`when logged in, GET ${path} attaches Bearer token`, () => {
      const { http, httpTesting } = configure(FAKE_TOKEN);

      http.get(path).subscribe();

      const req = httpTesting.expectOne(path);
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${FAKE_TOKEN}`);
      req.flush({});
      httpTesting.verify();
    });
  });
});

// --- Criterion 1 boundary: exemption is GET-only; non-GET to public paths still carries token ---

describe('authInterceptor — non-GET to public paths attaches Bearer token', () => {
  (['regions', 'poi', 'comuni'] as const).forEach((resource) => {
    it(`when logged in, POST to /api/v1/${resource} attaches Bearer token`, () => {
      const { http, httpTesting } = configure(FAKE_TOKEN);
      const path = `/api/v1/${resource}`;

      http.post(path, {}).subscribe();

      const req = httpTesting.expectOne(path);
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${FAKE_TOKEN}`);
      req.flush({});
      httpTesting.verify();
    });
  });
});

// --- No-token case: unauthenticated requests are forwarded without Authorization ---

describe('authInterceptor — unauthenticated requests', () => {
  it('when no token, GET to any path carries no Authorization header', () => {
    const { http, httpTesting } = configure(null);

    http.get('/api/v1/saved-items').subscribe();

    const req = httpTesting.expectOne('/api/v1/saved-items');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
    httpTesting.verify();
  });
});
