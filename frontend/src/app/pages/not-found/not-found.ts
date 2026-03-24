import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      class="min-h-screen bg-surface text-text flex flex-col items-center justify-center px-6 text-center animate-fade-in-up"
      role="main"
    >
      <p
        class="font-display text-[8rem] leading-none font-extrabold text-primary opacity-20 select-none"
        aria-hidden="true"
      >
        404
      </p>
      <h1 class="font-display text-3xl font-bold tracking-tight mt-2">
        Pagina non trovata
      </h1>
      <p class="mt-3 text-text-secondary max-w-sm">
        La pagina che stai cercando non esiste o è stata spostata.
      </p>
      <a
        routerLink="/"
        class="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12 11.204 3.045c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
        Torna alla home
      </a>
    </main>
  `,
})
export class NotFoundComponent {}
