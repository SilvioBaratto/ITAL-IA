import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideHouse } from '@lucide/angular';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, LucideHouse],
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
        <svg lucideHouse class="w-4 h-4" aria-hidden="true"></svg>
        Torna alla home
      </a>
    </main>
  `,
})
export class NotFoundComponent {}
