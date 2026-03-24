import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SavedItemsService } from '../../services/saved-items.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile-page',
  imports: [],
  templateUrl: './profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent {
  private readonly authService = inject(AuthService);
  private readonly savedItemsService = inject(SavedItemsService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;
  readonly savedCount = this.savedItemsService.total;

  readonly email = computed(() => this.currentUser()?.email ?? '');

  readonly memberSince = computed(() => {
    const createdAt = this.currentUser()?.created_at;
    if (!createdAt) return '';
    return new Date(createdAt).toLocaleDateString('it-IT', {
      month: 'long',
      year: 'numeric',
    });
  });

  readonly provider = computed(() => {
    const providers = this.currentUser()?.app_metadata?.['providers'] as string[] | undefined;
    return providers?.[0] ?? 'email';
  });

  readonly isDeleting = signal(false);
  readonly deleteError = signal('');
  readonly showDeleteConfirm = signal(false);

  confirmDelete(): void {
    this.showDeleteConfirm.set(true);
    this.deleteError.set('');
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.deleteError.set('');
  }

  async executeDelete(): Promise<void> {
    if (this.isDeleting()) return;
    this.isDeleting.set(true);
    this.deleteError.set('');

    try {
      await firstValueFrom(this.http.delete(`${environment.apiUrl}auth/account`));
      await this.authService.logout();
      this.router.navigate(['/login'], { replaceUrl: true });
    } catch (err: unknown) {
      this.isDeleting.set(false);
      const message =
        err instanceof HttpErrorResponse
          ? (err.error?.message ?? "Impossibile eliminare l'account.")
          : "Impossibile eliminare l'account.";
      this.deleteError.set(message);
    }
  }
}
