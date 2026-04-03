import { Injectable, signal, computed } from '@angular/core';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export type GeoPermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  readonly position = signal<GeoPosition | null>(null);
  readonly loading = signal(false);
  readonly permissionState = signal<GeoPermissionState>(
    typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'prompt' : 'unavailable',
  );

  readonly hasPosition = computed(() => this.position() !== null);
  readonly isAvailable = computed(() => this.permissionState() !== 'unavailable');
  readonly isDenied = computed(() => this.permissionState() === 'denied');

  constructor() {
    this.initPermissionListener();
  }

  getCurrentPosition(options?: PositionOptions): Promise<GeoPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        this.permissionState.set('unavailable');
        reject(new Error('Geolocation not supported'));
        return;
      }

      this.loading.set(true);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geoPos: GeoPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          };
          this.position.set(geoPos);
          this.permissionState.set('granted');
          this.loading.set(false);
          resolve(geoPos);
        },
        (err) => {
          this.loading.set(false);
          if (err.code === 1) this.permissionState.set('denied');
          reject(err);
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000, ...options },
      );
    });
  }

  private async initPermissionListener(): Promise<void> {
    if (typeof navigator === 'undefined' || !('permissions' in navigator)) return;

    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      this.permissionState.set(status.state as GeoPermissionState);
      status.addEventListener('change', () => {
        this.permissionState.set(status.state as GeoPermissionState);
      });
    } catch {
      // Permissions API not supported — degrade gracefully
    }
  }
}
