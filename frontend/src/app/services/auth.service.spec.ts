import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Session, User } from '@supabase/supabase-js';
import { AuthService, SUPABASE_CLIENT } from './auth.service';

// ── Mock factory ──────────────────────────────────────────────────────────────

interface MockSupabaseSetup {
  session?: Session | null;
  getSessionRejects?: boolean;
}

function makeUser(id = 'user-1'): User {
  return { id, email: 'test@example.com' } as User;
}

function makeSession(userId = 'user-1', token = 'access-token'): Session {
  return { access_token: token, refresh_token: 'rt', user: makeUser(userId) } as Session;
}

function makeMockSupabase(opts: MockSupabaseSetup = {}) {
  let authStateCallback: ((event: string, session: Session | null) => void) | null = null;

  const auth = {
    getSession: jasmine.createSpy('getSession').and.returnValue(
      opts.getSessionRejects
        ? Promise.reject(new Error('Supabase error'))
        : Promise.resolve({ data: { session: opts.session ?? null }, error: null }),
    ),
    onAuthStateChange: jasmine
      .createSpy('onAuthStateChange')
      .and.callFake((cb: (event: string, session: Session | null) => void) => {
        authStateCallback = cb;
        return { data: { subscription: { unsubscribe: jasmine.createSpy('unsubscribe') } } };
      }),
    signInWithPassword: jasmine
      .createSpy('signInWithPassword')
      .and.returnValue(Promise.resolve({ error: null })),
    signUp: jasmine
      .createSpy('signUp')
      .and.returnValue(Promise.resolve({ error: null })),
    signOut: jasmine
      .createSpy('signOut')
      .and.returnValue(Promise.resolve({ error: null })),
    refreshSession: jasmine
      .createSpy('refreshSession')
      .and.returnValue(Promise.resolve({ data: { session: makeSession() }, error: null })),
    resetPasswordForEmail: jasmine
      .createSpy('resetPasswordForEmail')
      .and.returnValue(Promise.resolve({ error: null })),
    updateUser: jasmine
      .createSpy('updateUser')
      .and.returnValue(Promise.resolve({ error: null })),
    signInWithOAuth: jasmine
      .createSpy('signInWithOAuth')
      .and.returnValue(Promise.resolve({ error: null })),
  };

  const client = { auth };

  return {
    client,
    triggerAuthChange: (event: string, session: Session | null) => authStateCallback?.(event, session),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  function setup(opts: MockSupabaseSetup = {}) {
    const { client, triggerAuthChange } = makeMockSupabase(opts);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: SUPABASE_CLIENT, useValue: client },
      ],
    });

    const service = TestBed.inject(AuthService);
    return { service, authSpy: client.auth, triggerAuthChange };
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  it('sets isAuthenticated=true and caches the token when session exists', async () => {
    const { service } = setup({ session: makeSession('u1', 'tok') });
    await service.waitUntilInitialized();
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.id).toBe('u1');
    expect(service.getAccessToken()).toBe('tok');
    expect(service.isInitialized()).toBe(true);
  });

  it('sets isAuthenticated=false when no session exists', async () => {
    const { service } = setup({ session: null });
    await service.waitUntilInitialized();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.getAccessToken()).toBeNull();
    expect(service.isInitialized()).toBe(true);
  });

  it('sets isAuthenticated=false and isInitialized=true when getSession throws', async () => {
    const { service } = setup({ getSessionRejects: true });
    await service.waitUntilInitialized();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isInitialized()).toBe(true);
  });

  // ── onAuthStateChange ─────────────────────────────────────────────────────

  it('updates signals on SIGNED_IN auth state change', async () => {
    const { service, triggerAuthChange } = setup({ session: null });
    await service.waitUntilInitialized();
    triggerAuthChange('SIGNED_IN', makeSession('u2', 'new-tok'));
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.id).toBe('u2');
    expect(service.getAccessToken()).toBe('new-tok');
  });

  it('clears signals on SIGNED_OUT auth state change', async () => {
    const { service, triggerAuthChange } = setup({ session: makeSession() });
    await service.waitUntilInitialized();
    triggerAuthChange('SIGNED_OUT', null);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.getAccessToken()).toBeNull();
  });

  it('sets isPasswordRecovery=true on PASSWORD_RECOVERY event', async () => {
    const { service, triggerAuthChange } = setup({ session: null });
    await service.waitUntilInitialized();
    triggerAuthChange('PASSWORD_RECOVERY', makeSession());
    expect(service.isPasswordRecovery()).toBe(true);
  });

  // ── login ─────────────────────────────────────────────────────────────────

  it('login returns { success: true } on success', async () => {
    const { service, authSpy } = setup();
    authSpy.signInWithPassword.and.returnValue(Promise.resolve({ error: null }));
    const result = await service.login('a@b.com', 'pass');
    expect(result.success).toBe(true);
  });

  it('login returns { success: false, message } on error', async () => {
    const { service, authSpy } = setup();
    authSpy.signInWithPassword.and.returnValue(
      Promise.resolve({ error: { message: 'Invalid credentials' } }),
    );
    const result = await service.login('a@b.com', 'wrong');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid credentials');
  });

  // ── signup ────────────────────────────────────────────────────────────────

  it('signup returns { success: true } on success', async () => {
    const { service, authSpy } = setup();
    authSpy.signUp.and.returnValue(Promise.resolve({ error: null }));
    const result = await service.signup('a@b.com', 'pass');
    expect(result.success).toBe(true);
  });

  it('signup returns { success: false, message } on error', async () => {
    const { service, authSpy } = setup();
    authSpy.signUp.and.returnValue(
      Promise.resolve({ error: { message: 'Email taken' } }),
    );
    const result = await service.signup('a@b.com', 'pass');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Email taken');
  });

  // ── logout ────────────────────────────────────────────────────────────────

  it('logout resets all signals regardless of signOut result', async () => {
    const { service, authSpy } = setup({ session: makeSession() });
    await service.waitUntilInitialized();
    authSpy.signOut.and.returnValue(Promise.resolve({ error: { message: 'already signed out' } }));
    await service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.getAccessToken()).toBeNull();
    expect(service.isPasswordRecovery()).toBe(false);
  });

  // ── refreshSession ────────────────────────────────────────────────────────

  it('refreshSession returns the new access token and updates the cache', async () => {
    const { service, authSpy } = setup();
    authSpy.refreshSession.and.returnValue(
      Promise.resolve({ data: { session: makeSession('u1', 'fresh-token') }, error: null }),
    );
    const token = await service.refreshSession();
    expect(token).toBe('fresh-token');
    expect(service.getAccessToken()).toBe('fresh-token');
  });

  it('refreshSession returns null on error', async () => {
    const { service, authSpy } = setup();
    authSpy.refreshSession.and.returnValue(
      Promise.resolve({ data: { session: null }, error: { message: 'expired' } }),
    );
    expect(await service.refreshSession()).toBeNull();
  });

  // ── updatePassword ────────────────────────────────────────────────────────

  it('updatePassword returns success and clears isPasswordRecovery', async () => {
    const { service, authSpy, triggerAuthChange } = setup();
    await service.waitUntilInitialized();
    triggerAuthChange('PASSWORD_RECOVERY', makeSession());
    expect(service.isPasswordRecovery()).toBe(true);

    authSpy.updateUser.and.returnValue(Promise.resolve({ error: null }));
    const result = await service.updatePassword('newpass123');
    expect(result.success).toBe(true);
    expect(service.isPasswordRecovery()).toBe(false);
  });

  it('updatePassword returns { success: false } on error', async () => {
    const { service, authSpy } = setup();
    authSpy.updateUser.and.returnValue(
      Promise.resolve({ error: { message: 'Too weak' } }),
    );
    const result = await service.updatePassword('123');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Too weak');
  });
});
