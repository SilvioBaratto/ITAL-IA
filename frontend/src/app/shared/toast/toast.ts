import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fixed left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse items-center gap-2 pointer-events-none toast-position' },
  template: `
    @for (toast of toastService.toasts(); track toast.id) {
    <div
      class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl bg-text text-surface-raised text-sm font-medium shadow-lg animate-toast-in"
      role="status"
      aria-live="polite"
      lang="it">
      <span>{{ toast.message }}</span>
      @if (toast.undoAction) {
      <button
        (click)="toastService.undo(toast.id)"
        class="shrink-0 px-3 py-1.5 rounded-md text-primary font-semibold hover:bg-white/10 transition-colors min-h-[44px]">
        Annulla
      </button>
      }
      <button
        (click)="toastService.dismiss(toast.id)"
        class="shrink-0 p-2 rounded-md text-surface-inset hover:text-white hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Chiudi notifica">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    }
  `,
  styles: [`
    :host.toast-position {
      bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
    }

    @media (min-width: 768px) {
      :host.toast-position {
        bottom: 1.5rem;
      }
    }

    @media (prefers-reduced-motion: no-preference) {
      .animate-toast-in {
        animation: toast-slide-up 0.25s ease-out;
      }

      @keyframes toast-slide-up {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    }
  `],
})
export class ToastComponent {
  readonly toastService = inject(ToastService);
}
