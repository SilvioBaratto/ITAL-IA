import { Directive, ElementRef, inject, NgZone, OnInit, OnDestroy } from '@angular/core';

/**
 * Enables desktop-friendly horizontal scrolling on overflow-x containers:
 *  - Vertical mouse wheel → native browser smooth scroll (respects snap points)
 *  - Click-and-drag with momentum/inertia after release
 *
 * Only activates when `pointer: fine` (mouse/trackpad). Touch devices
 * already handle horizontal swiping natively.
 *
 * Usage: <div appHorizontalScroll class="overflow-x-auto ...">
 */
@Directive({ selector: '[appHorizontalScroll]' })
export class HorizontalScrollDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  /** Friction coefficient for momentum decay. Range 0–1; higher = longer glide. */
  private readonly FRICTION = 0.95;

  /** Minimum velocity (px/frame) below which momentum animation stops. */
  private readonly VELOCITY_CUTOFF = 0.5;

  /** Minimum drag distance (px) to classify interaction as drag, not click. */
  private readonly DRAG_THRESHOLD = 3;

  /** Number of recent pointer samples used to compute release velocity. */
  private readonly VELOCITY_SAMPLE_COUNT = 3;

  /* ── Drag state ── */
  private dragging = false;
  private startX = 0;
  private scrollStart = 0;
  private hasMoved = false;

  /* ── Velocity tracking ── */
  private velocitySamples: Array<{ pageX: number; timestamp: number }> = [];
  private momentumRafId: number | null = null;

  /* ── Snap preservation ── */
  private savedSnapType = '';

  /* ── Wheel: delegate to native browser smooth scroll ── */
  private onWheel = (e: WheelEvent): void => {
    const host = this.el.nativeElement;
    if (host.scrollWidth <= host.clientWidth) return;
    if (e.deltaY === 0) return;

    e.preventDefault();
    host.scrollBy({ left: e.deltaY, behavior: 'smooth' });
  };

  /* ── Drag: mousedown begins grab interaction ── */
  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    const host = this.el.nativeElement;
    if (host.scrollWidth <= host.clientWidth) return;

    this.cancelMomentum();

    this.dragging = true;
    this.hasMoved = false;
    this.startX = e.pageX;
    this.scrollStart = host.scrollLeft;
    this.velocitySamples = [{ pageX: e.pageX, timestamp: e.timeStamp }];

    // Disable snap during drag so it does not fight manual scrollLeft writes.
    this.savedSnapType = host.style.scrollSnapType;
    host.style.scrollSnapType = 'none';

    host.style.cursor = 'grabbing';
    host.style.userSelect = 'none';
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.dragging) return;

    const dx = e.pageX - this.startX;
    if (Math.abs(dx) > this.DRAG_THRESHOLD) this.hasMoved = true;

    const host = this.el.nativeElement;
    host.scrollLeft = this.scrollStart - dx;

    // Keep only the most recent N samples for velocity calculation.
    this.velocitySamples.push({ pageX: e.pageX, timestamp: e.timeStamp });
    if (this.velocitySamples.length > this.VELOCITY_SAMPLE_COUNT) {
      this.velocitySamples.shift();
    }
  };

  private onMouseUp = (): void => {
    if (!this.dragging) return;
    this.dragging = false;

    const host = this.el.nativeElement;
    host.style.cursor = 'grab';
    host.style.userSelect = '';

    const velocity = this.computeReleaseVelocity();
    if (Math.abs(velocity) > this.VELOCITY_CUTOFF) {
      this.runMomentum(host, velocity);
    } else {
      this.restoreSnap(host);
    }
  };

  private onClick = (e: MouseEvent): void => {
    if (this.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  /* ── Velocity helpers ── */

  /**
   * Derive release velocity (px/ms) from the recorded pointer samples,
   * then scale to px/frame (assuming 16ms ≈ 60fps).
   */
  private computeReleaseVelocity(): number {
    if (this.velocitySamples.length < 2) return 0;

    const first = this.velocitySamples[0];
    const last = this.velocitySamples[this.velocitySamples.length - 1];
    const dt = last.timestamp - first.timestamp;
    if (dt === 0) return 0;

    const pxPerMs = (first.pageX - last.pageX) / dt;
    return pxPerMs * 16; // convert to px/frame at 60fps
  }

  /**
   * Animate post-release momentum with exponential decay.
   * Restores scroll-snap only after the animation settles.
   */
  private runMomentum(host: HTMLElement, initialVelocity: number): void {
    let velocity = initialVelocity;

    const step = (): void => {
      velocity *= this.FRICTION;
      host.scrollLeft += velocity;

      if (Math.abs(velocity) > this.VELOCITY_CUTOFF) {
        this.momentumRafId = requestAnimationFrame(step);
      } else {
        this.momentumRafId = null;
        this.restoreSnap(host);
      }
    };

    this.momentumRafId = requestAnimationFrame(step);
  }

  private cancelMomentum(): void {
    if (this.momentumRafId !== null) {
      cancelAnimationFrame(this.momentumRafId);
      this.momentumRafId = null;
    }
  }

  private restoreSnap(host: HTMLElement): void {
    host.style.scrollSnapType = this.savedSnapType;
  }

  /* ── Lifecycle ── */

  ngOnInit(): void {
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const host = this.el.nativeElement;

    this.zone.runOutsideAngular(() => {
      host.addEventListener('wheel', this.onWheel, { passive: false });
      host.addEventListener('mousedown', this.onMouseDown);
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
      host.addEventListener('click', this.onClick, { capture: true });
    });

    host.style.cursor = 'grab';
  }

  ngOnDestroy(): void {
    this.cancelMomentum();

    const host = this.el.nativeElement;
    host.removeEventListener('wheel', this.onWheel);
    host.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    host.removeEventListener('click', this.onClick, { capture: true } as EventListenerOptions);
  }
}
