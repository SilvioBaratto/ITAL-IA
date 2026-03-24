import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);

  isLoading = signal(false);
  errorMessage = signal('');

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
}
