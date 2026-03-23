import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabase: SupabaseClient;
  private initPromise: Promise<void>;
  private cachedAccessToken: string | null = null;

  isAuthenticated = signal(false);
  isInitialized = signal(false);
  currentUser = signal<User | null>(null);
  isPasswordRecovery = signal(false);

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);

    this.initPromise = this.supabase.auth.getSession()
      .then(({ data: { session } }) => {
        this.isAuthenticated.set(!!session);
        this.currentUser.set(session?.user ?? null);
        this.cachedAccessToken = session?.access_token ?? null;
      })
      .catch(() => {
        this.isAuthenticated.set(false);
        this.currentUser.set(null);
        this.cachedAccessToken = null;
      })
      .finally(() => {
        this.isInitialized.set(true);
      });

    this.supabase.auth.onAuthStateChange((event, session) => {
      this.isAuthenticated.set(!!session);
      this.currentUser.set(session?.user ?? null);
      this.cachedAccessToken = session?.access_token ?? null;

      if (event === 'PASSWORD_RECOVERY') {
        this.isPasswordRecovery.set(true);
      }
    });
  }

  waitUntilInitialized(): Promise<void> {
    return this.initPromise;
  }

  async login(email: string, password: string): Promise<{ success: boolean; message: string }> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Authenticated' };
  }

  async signup(email: string, password: string): Promise<{ success: boolean; message: string }> {
    const { error } = await this.supabase.auth.signUp({ email, password });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Check your email to confirm your account.' };
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth/update-password',
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Check your email for a password reset link.' };
  }

  async updatePassword(newPassword: string): Promise<{ success: boolean; message: string }> {
    const { error } = await this.supabase.auth.updateUser({ password: newPassword });

    if (error) {
      return { success: false, message: error.message };
    }

    this.isPasswordRecovery.set(false);
    return { success: true, message: 'Password updated successfully.' };
  }

  async loginWithGoogle(): Promise<void> {
    await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  getAccessToken(): string | null {
    return this.cachedAccessToken;
  }

  async refreshSession(): Promise<boolean> {
    const { data: { session }, error } = await this.supabase.auth.refreshSession();
    if (error || !session) {
      return false;
    }
    return true;
  }

  async logout(): Promise<void> {
    try {
      await this.supabase.auth.signOut();
    } finally {
      this.isAuthenticated.set(false);
      this.currentUser.set(null);
      this.isPasswordRecovery.set(false);
      this.cachedAccessToken = null;
    }
  }
}
