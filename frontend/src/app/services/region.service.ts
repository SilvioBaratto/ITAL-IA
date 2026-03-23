import { Injectable, computed, signal } from '@angular/core';
import { Region } from '../models/region.model';

const STORAGE_KEY = 'italia-region';
const DEFAULT_REGION = 'friuli-venezia-giulia';

const ALL_REGIONS: Region[] = [
  // Nord
  { id: 'piemonte', name: 'Piemonte', group: 'nord', hasKB: false },
  { id: 'valle-d-aosta', name: "Valle d'Aosta", group: 'nord', hasKB: false },
  { id: 'lombardia', name: 'Lombardia', group: 'nord', hasKB: false },
  { id: 'trentino-alto-adige', name: 'Trentino-Alto Adige', group: 'nord', hasKB: false },
  { id: 'veneto', name: 'Veneto', group: 'nord', hasKB: false },
  { id: 'friuli-venezia-giulia', name: 'Friuli Venezia Giulia', group: 'nord', hasKB: true },
  { id: 'liguria', name: 'Liguria', group: 'nord', hasKB: false },
  { id: 'emilia-romagna', name: 'Emilia-Romagna', group: 'nord', hasKB: false },
  // Centro
  { id: 'toscana', name: 'Toscana', group: 'centro', hasKB: false },
  { id: 'umbria', name: 'Umbria', group: 'centro', hasKB: false },
  { id: 'marche', name: 'Marche', group: 'centro', hasKB: false },
  { id: 'lazio', name: 'Lazio', group: 'centro', hasKB: false },
  { id: 'abruzzo', name: 'Abruzzo', group: 'centro', hasKB: false },
  { id: 'molise', name: 'Molise', group: 'centro', hasKB: false },
  // Sud
  { id: 'campania', name: 'Campania', group: 'sud', hasKB: false },
  { id: 'puglia', name: 'Puglia', group: 'sud', hasKB: false },
  { id: 'basilicata', name: 'Basilicata', group: 'sud', hasKB: false },
  { id: 'calabria', name: 'Calabria', group: 'sud', hasKB: false },
  // Isole
  { id: 'sicilia', name: 'Sicilia', group: 'isole', hasKB: false },
  { id: 'sardegna', name: 'Sardegna', group: 'isole', hasKB: false },
];

@Injectable({
  providedIn: 'root',
})
export class RegionService {
  readonly regions = signal<Region[]>(ALL_REGIONS);

  readonly selectedRegion = signal<Region>(
    this.loadPersistedRegion(),
  );

  readonly selectedRegionHasKB = computed(() => this.selectedRegion().hasKB);

  selectRegion(id: string): void {
    const region = ALL_REGIONS.find((r) => r.id === id);
    if (!region) return;
    this.selectedRegion.set(region);
    localStorage.setItem(STORAGE_KEY, id);
  }

  private loadPersistedRegion(): Region {
    const storedId = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_REGION;
    return ALL_REGIONS.find((r) => r.id === storedId)
      ?? ALL_REGIONS.find((r) => r.id === DEFAULT_REGION)!;
  }
}
