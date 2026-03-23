import { Component, signal, inject, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-update-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './update-password.html',
  styleUrl: './update-password.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdatePasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  });

  isLoading = signal(false);
  errorMessage = signal('');
  updated = signal(false);
  noRecoverySession = signal(false);

  constructor() {
    this.authService.waitUntilInitialized().then(() => {
      if (!this.authService.isPasswordRecovery() && !this.authService.isAuthenticated()) {
        this.noRecoverySession.set(true);
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.isLoading() || this.form.invalid) return;

    const { password, confirmPassword } = this.form.getRawValue();

    if (password !== confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const result = await this.authService.updatePassword(password);

    this.isLoading.set(false);

    if (result.success) {
      this.updated.set(true);
      const timer = setTimeout(() => this.router.navigate(['/'], { replaceUrl: true }), 2000);
      this.destroyRef.onDestroy(() => clearTimeout(timer));
    } else {
      this.errorMessage.set(result.message);
    }
  }
}
