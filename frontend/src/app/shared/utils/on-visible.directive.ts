import {
  Directive,
  ElementRef,
  inject,
  input,
  output,
  OnInit,
  OnDestroy,
  effect,
} from '@angular/core';

/**
 * Emits `appOnVisible` whenever the host element intersects the viewport.
 * Used as an infinite-scroll sentinel: place a small invisible element at
 * the bottom of a list and bind `(appOnVisible)="loadMore()"`.
 *
 * The directive re-emits on every intersection enter (not once), so the
 * caller is responsible for guarding against duplicate loads (e.g. by
 * checking a `loading` flag). This matches how real sentinels work when
 * the user scrolls back up and down.
 */
@Directive({ selector: '[appOnVisible]' })
export class OnVisibleDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<Element>);

  readonly appOnVisible = output<void>();
  readonly appOnVisibleRootMargin = input<string>('200px');
  readonly appOnVisibleDisabled = input<boolean>(false);

  private observer: IntersectionObserver | null = null;

  constructor() {
    // Re-create the observer when disabled toggles. We can't move this to
    // ngOnInit because the effect needs to run on signal changes too.
    effect(() => {
      const disabled = this.appOnVisibleDisabled();
      if (disabled) {
        this.teardown();
      } else {
        this.setup();
      }
    });
  }

  ngOnInit(): void {
    if (!this.appOnVisibleDisabled()) this.setup();
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  private setup(): void {
    if (this.observer) return;
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.appOnVisible.emit();
          }
        }
      },
      { rootMargin: this.appOnVisibleRootMargin() },
    );
    this.observer.observe(this.el.nativeElement);
  }

  private teardown(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
