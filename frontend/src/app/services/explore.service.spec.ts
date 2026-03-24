import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExploreService } from './explore.service';
import { RegionService } from './region.service';
import { Region } from '../models/region.model';
import { ExploreData } from '../models/explore.model';

const FRIULI: Region = {
  id: 'friuli-venezia-giulia',
  name: 'Friuli Venezia Giulia',
  group: 'nord',
  hasKB: true,
};
const TOSCANA: Region = { id: 'toscana', name: 'Toscana', group: 'centro', hasKB: false };

const MOCK_DATA: ExploreData = {
  regionId: 'friuli-venezia-giulia',
  categories: [
    { id: 'food', label: 'Cibo', icon: '🍕', prompts: [{ text: 'Pizza', fullPrompt: 'Tell me about pizza' }] },
  ],
};

const DEFAULT_DATA: ExploreData = {
  regionId: '_default',
  categories: [{ id: 'default', label: 'Default', icon: '🌍', prompts: [] }],
};

describe('ExploreService', () => {
  let service: ExploreService;
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

    service = TestBed.inject(ExploreService);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.flushEffects(); // flush initial effect so HTTP request is queued
  }

  afterEach(() => {
    httpMock?.verify();
  });

  it('queues an HTTP request for the initial region on construction', () => {
    setup();
    httpMock.expectOne('assets/explore/friuli-venezia-giulia.json').flush(MOCK_DATA);
    expect(service.prompts().length).toBe(1);
  });

  it('loading is true while the request is pending and false after', () => {
    setup();
    expect(service.loading()).toBe(true);
    httpMock.expectOne('assets/explore/friuli-venezia-giulia.json').flush(MOCK_DATA);
    expect(service.loading()).toBe(false);
  });

  it('hasPrompts is false before load and true after', () => {
    setup();
    expect(service.hasPrompts()).toBe(false);
    httpMock.expectOne('assets/explore/friuli-venezia-giulia.json').flush(MOCK_DATA);
    expect(service.hasPrompts()).toBe(true);
  });

  it('error is false on successful load', () => {
    setup();
    httpMock.expectOne('assets/explore/friuli-venezia-giulia.json').flush(MOCK_DATA);
    expect(service.error()).toBe(false);
  });

  it('falls back to _default.json when the region file returns an error', () => {
    setup();
    httpMock.expectOne('assets/explore/friuli-venezia-giulia.json').error(new ErrorEvent('404'));
    httpMock.expectOne('assets/explore/_default.json').flush(DEFAULT_DATA);
    expect(service.prompts()[0].id).toBe('default');
    expect(service.loading()).toBe(false);
  });

  it('sets error=true and empty prompts when _default.json also fails', () => {
    setup();
    httpMock.expectOne('assets/explore/friuli-venezia-giulia.json').error(new ErrorEvent('404'));
    httpMock.expectOne('assets/explore/_default.json').error(new ErrorEvent('404'));
    expect(service.error()).toBe(true);
    expect(service.prompts()).toEqual([]);
    expect(service.loading()).toBe(false);
  });

  it('loads new region data when selectedRegion changes', () => {
    setup();
    httpMock.expectOne('assets/explore/friuli-venezia-giulia.json').flush(MOCK_DATA);

    regionSignal.set(TOSCANA);
    TestBed.flushEffects();
    httpMock.expectOne('assets/explore/toscana.json').flush(MOCK_DATA);
    expect(service.prompts().length).toBe(1);
  });

  it('serves cached data without an HTTP call on a repeated request for the same region', () => {
    setup();
    httpMock.expectOne('assets/explore/friuli-venezia-giulia.json').flush(MOCK_DATA);

    // Change away then back
    regionSignal.set(TOSCANA);
    TestBed.flushEffects();
    httpMock.expectOne('assets/explore/toscana.json').flush(MOCK_DATA);

    regionSignal.set(FRIULI);
    TestBed.flushEffects();
    httpMock.expectNone('assets/explore/friuli-venezia-giulia.json'); // cache hit
    expect(service.prompts().length).toBe(1);
  });

  it('uses cached _default.json for a second fallback without a new HTTP call', () => {
    setup();
    // First region fails — loads _default
    httpMock.expectOne('assets/explore/friuli-venezia-giulia.json').error(new ErrorEvent('404'));
    httpMock.expectOne('assets/explore/_default.json').flush(DEFAULT_DATA);

    // Second region also fails — should use cached _default
    regionSignal.set(TOSCANA);
    TestBed.flushEffects();
    httpMock.expectOne('assets/explore/toscana.json').error(new ErrorEvent('404'));
    httpMock.expectNone('assets/explore/_default.json');
    expect(service.prompts()[0].id).toBe('default');
  });
});
