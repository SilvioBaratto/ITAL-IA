import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  isLoading = signal(false);
  errorMessage = signal('');
  emailSent = signal(false);

  async onSubmit(): Promise<void> {
    if (this.isLoading() || this.form.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    const { email } = this.form.getRawValue();
    const result = await this.authService.forgotPassword(email.trim());

    this.isLoading.set(false);

    if (result.success) {
      this.emailSent.set(true);
    } else {
      this.errorMessage.set(result.message);
    }
  }
}
