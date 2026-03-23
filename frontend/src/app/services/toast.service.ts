import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  message: string;
  undoAction?: () => void;
  timerId?: ReturnType<typeof setTimeout>;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly toastsSignal = signal<Toast[]>([]);
  readonly toasts = this.toastsSignal.asReadonly();

  private static readonly MAX_TOASTS = 3;

  show(message: string, undoAction?: () => void): void {
    const id = crypto.randomUUID();
    const timerId = setTimeout(() => this.dismiss(id), 5000);

    this.toastsSignal.update((prev) => {
      const next = [...prev, { id, message, undoAction, timerId }];
      // Dismiss oldest if exceeding max
      while (next.length > ToastService.MAX_TOASTS) {
        const oldest = next.shift();
        if (oldest?.timerId) clearTimeout(oldest.timerId);
      }
      return next;
    });
  }

  dismiss(id: string): void {
    this.toastsSignal.update((prev) => {
      const toast = prev.find((t) => t.id === id);
      if (toast?.timerId) clearTimeout(toast.timerId);
      return prev.filter((t) => t.id !== id);
    });
  }

  undo(id: string): void {
    const toast = this.toastsSignal().find((t) => t.id === id);
    toast?.undoAction?.();
    this.dismiss(id);
  }
}
