import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  });

  mode = signal<'login' | 'signup'>('login');
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  private returnUrl = this.sanitizeReturnUrl(
    this.route.snapshot.queryParams['returnUrl']
  );

  toggleMode() {
    const next = this.mode() === 'login' ? 'signup' : 'login';
    this.mode.set(next);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.form.reset();
  }

  async onGoogleLogin(): Promise<void> {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      await this.authService.loginWithGoogle();
    } catch {
      this.errorMessage.set('Failed to start Google sign in.');
      this.isLoading.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.isLoading() || this.form.controls.email.invalid || this.form.controls.password.invalid) return;

    const { email, password, confirmPassword } = this.form.getRawValue();

    if (this.mode() === 'signup') {
      if (password !== confirmPassword) {
        this.errorMessage.set('Passwords do not match.');
        return;
      }
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const trimmedEmail = email.trim();

    if (this.mode() === 'login') {
      const result = await this.authService.login(trimmedEmail, password.trim());
      this.isLoading.set(false);

      if (result.success) {
        this.router.navigate([this.returnUrl], { replaceUrl: true });
      } else {
        this.errorMessage.set(result.message);
      }
    } else {
      const result = await this.authService.signup(trimmedEmail, password.trim());
      this.isLoading.set(false);

      if (result.success) {
        this.successMessage.set(result.message);
        this.form.controls.password.reset();
        this.form.controls.confirmPassword.reset();
      } else {
        this.errorMessage.set(result.message);
      }
    }
  }

  private sanitizeReturnUrl(url: string | undefined): string {
    if (!url) return '/';
    try {
      const parsed = this.router.parseUrl(url);
      const serialized = this.router.serializeUrl(parsed);
      return serialized.startsWith('/') ? serialized : '/';
    } catch {
      return '/';
    }
  }
}
