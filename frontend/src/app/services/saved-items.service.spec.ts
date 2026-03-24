import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SavedItemsService } from './saved-items.service';
import { RegionService } from './region.service';
import { Region } from '../models/region.model';
import { PaginatedSavedItemsResponse, SaveItemRequest, SavedItem } from '../models/saved-item.model';
import { environment } from '../../environments/environment';

const ENDPOINT = `${environment.apiUrl}saved-items`;
const FRIULI: Region = { id: 'friuli-venezia-giulia', name: 'Friuli Venezia Giulia', group: 'nord', hasKB: true };
const TOSCANA: Region = { id: 'toscana', name: 'Toscana', group: 'centro', hasKB: false };

function makeItem(id: string, name = 'Item', region = 'friuli-venezia-giulia'): SavedItem {
  return {
    id,
    userId: 'u1',
    name,
    category: 'RESTAURANT',
    region,
    description: 'Desc',
    address: null,
    mapsUrl: null,
    website: null,
    imageUrl: null,
    savedAt: '',
  };
}

function paginatedOf(items: SavedItem[], total?: number): PaginatedSavedItemsResponse {
  return { data: items, total: total ?? items.length, limit: 20, offset: 0 };
}

describe('SavedItemsService', () => {
  let service: SavedItemsService;
  let httpMock: HttpTestingController;
  let regionSignal: ReturnType<typeof signal<Region>>;

  function setup(): void {
    regionSignal = signal<Region>(FRIULI);
    const fakeRegionService = { selectedRegion: regionSignal };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RegionService, useValue: fakeRegionService },
      ],
    });

    service = TestBed.inject(SavedItemsService);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.flushEffects(); // flush constructor effect so initial HTTP request is queued
  }

  /** Flush the initial load request triggered by the constructor effect. */
  function flushInitialLoad(items: SavedItem[] = [], total?: number): void {
    httpMock.expectOne((req) => req.url === ENDPOINT).flush(paginatedOf(items, total));
  }

  afterEach(() => {
    httpMock?.verify();
  });

  // ── Initial load ──────────────────────────────────────────────────────────

  it('loading is true before the first response and false after', () => {
    setup();
    expect(service.loading()).toBe(true);
    flushInitialLoad();
    expect(service.loading()).toBe(false);
  });

  it('hasSavedItems is false when empty and true after items are loaded', () => {
    setup();
    expect(service.hasSavedItems()).toBe(false);
    flushInitialLoad([makeItem('1')]);
    expect(service.hasSavedItems()).toBe(true);
  });

  it('savedItems returns the loaded items as an array', () => {
    setup();
    flushInitialLoad([makeItem('1', 'Ristorante Da Mario')]);
    expect(service.savedItems()[0].name).toBe('Ristorante Da Mario');
  });

  it('total reflects the value returned by the API', () => {
    setup();
    flushInitialLoad([makeItem('1')], 5);
    expect(service.total()).toBe(5);
  });

  it('error is set to true on initial load failure', () => {
    setup();
    httpMock.expectOne((req) => req.url === ENDPOINT).error(new ErrorEvent('network error'));
    expect(service.error()).toBe(true);
    expect(service.loading()).toBe(false);
  });

  // ── isSaved / getSavedItem ────────────────────────────────────────────────

  it('isSaved returns true for a loaded item', () => {
    setup();
    flushInitialLoad([makeItem('1')]);
    expect(service.isSaved('Item', 'friuli-venezia-giulia', 'RESTAURANT')).toBe(true);
  });

  it('isSaved returns false for an unknown item', () => {
    setup();
    flushInitialLoad();
    expect(service.isSaved('Unknown', 'friuli-venezia-giulia', 'RESTAURANT')).toBe(false);
  });

  it('getSavedItem returns the correct item', () => {
    setup();
    flushInitialLoad([makeItem('1', 'Trattoria')]);
    expect(service.getSavedItem('Trattoria', 'friuli-venezia-giulia', 'RESTAURANT')?.id).toBe('1');
  });

  // ── hasMore ───────────────────────────────────────────────────────────────

  it('hasMore is true when there are more items on the server', () => {
    setup();
    flushInitialLoad([makeItem('1')], 5);
    expect(service.hasMore()).toBe(true);
  });

  it('hasMore is false when all items are loaded', () => {
    setup();
    flushInitialLoad([makeItem('1')], 1);
    expect(service.hasMore()).toBe(false);
  });

  // ── save() ────────────────────────────────────────────────────────────────

  describe('save()', () => {
    const request: SaveItemRequest = {
      name: 'Trattoria',
      category: 'RESTAURANT',
      region: 'friuli-venezia-giulia',
      description: 'Good food',
    };

    it('optimistically adds the item before the HTTP response', () => {
      setup();
      flushInitialLoad();
      service.save(request).subscribe();
      expect(service.isSaved('Trattoria', 'friuli-venezia-giulia', 'RESTAURANT')).toBe(true);
      httpMock
        .expectOne((r) => r.url === ENDPOINT && r.method === 'POST')
        .flush(makeItem('server-id', 'Trattoria'));
    });

    it('updates the map with the server-assigned id on success', () => {
      setup();
      flushInitialLoad();
      service.save(request).subscribe();
      httpMock
        .expectOne((r) => r.url === ENDPOINT && r.method === 'POST')
        .flush(makeItem('server-id', 'Trattoria'));
      expect(service.getSavedItem('Trattoria', 'friuli-venezia-giulia', 'RESTAURANT')?.id).toBe(
        'server-id',
      );
    });

    it('rolls back the optimistic addition on HTTP error', () => {
      setup();
      flushInitialLoad();
      service.save(request).subscribe({ error: () => {} });
      httpMock
        .expectOne((r) => r.url === ENDPOINT && r.method === 'POST')
        .error(new ErrorEvent('error'));
      expect(service.isSaved('Trattoria', 'friuli-venezia-giulia', 'RESTAURANT')).toBe(false);
    });
  });

  // ── unsave() ──────────────────────────────────────────────────────────────

  describe('unsave()', () => {
    it('optimistically removes the item before the HTTP response', () => {
      setup();
      flushInitialLoad([makeItem('1')]);
      service.unsave('Item', 'friuli-venezia-giulia', 'RESTAURANT').subscribe();
      expect(service.isSaved('Item', 'friuli-venezia-giulia', 'RESTAURANT')).toBe(false);
      httpMock.expectOne((r) => r.url.endsWith('/1') && r.method === 'DELETE').flush(null);
    });

    it('decrements total optimistically', () => {
      setup();
      flushInitialLoad([makeItem('1')], 1);
      service.unsave('Item', 'friuli-venezia-giulia', 'RESTAURANT').subscribe();
      expect(service.total()).toBe(0);
      httpMock.expectOne((r) => r.method === 'DELETE').flush(null);
    });

    it('rolls back item and total on HTTP error', () => {
      setup();
      flushInitialLoad([makeItem('1')], 1);
      service.unsave('Item', 'friuli-venezia-giulia', 'RESTAURANT').subscribe({ error: () => {} });
      httpMock.expectOne((r) => r.method === 'DELETE').error(new ErrorEvent('error'));
      expect(service.isSaved('Item', 'friuli-venezia-giulia', 'RESTAURANT')).toBe(true);
      expect(service.total()).toBe(1);
    });

    it('returns EMPTY immediately when the item has no id', () => {
      setup();
      flushInitialLoad();
      let completed = false;
      service
        .unsave('Unknown', 'friuli-venezia-giulia', 'RESTAURANT')
        .subscribe({ complete: () => { completed = true; } });
      expect(completed).toBe(true);
      httpMock.expectNone((r) => r.method === 'DELETE');
    });
  });

  // ── loadMore() ────────────────────────────────────────────────────────────

  it('loadMore merges new items into the existing map', () => {
    setup();
    flushInitialLoad([makeItem('1', 'First')], 2);
    service.loadMore().subscribe();
    httpMock.expectOne((r) => r.url === ENDPOINT).flush(paginatedOf([makeItem('2', 'Second')]));
    expect(service.savedItems().length).toBe(2);
  });

  it('loadMore sets loadingMore=true then false', () => {
    setup();
    flushInitialLoad();
    service.loadMore().subscribe();
    expect(service.loadingMore()).toBe(true);
    httpMock.expectOne((r) => r.url === ENDPOINT).flush(paginatedOf([]));
    expect(service.loadingMore()).toBe(false);
  });

  // ── Region change ─────────────────────────────────────────────────────────

  it('region change triggers a new load and resets the map', () => {
    setup();
    flushInitialLoad([makeItem('1')], 1);
    expect(service.savedItems().length).toBe(1);

    regionSignal.set(TOSCANA);
    TestBed.flushEffects();

    const req = httpMock.expectOne((r) => r.url === ENDPOINT);
    expect(req.request.params.get('region')).toBe('toscana');
    req.flush(paginatedOf([]));
    expect(service.savedItems().length).toBe(0);
  });
});
