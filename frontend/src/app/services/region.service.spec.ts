import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { RegionService } from './region.service';

const ENDPOINT = `${environment.apiUrl}regions`;

describe('RegionService', () => {
  let service: RegionService;
  let httpMock: HttpTestingController;

  /** Sets up localStorage spies BEFORE the service is created, then injects it. */
  function setup(storedRegionId: string | null = null): void {
    spyOn(localStorage, 'getItem').and.callFake((key: string) =>
      key === 'italia-region' ? storedRegionId : null,
    );
    spyOn(localStorage, 'setItem');

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    // Service is created here — localStorage spies are already in place
    service = TestBed.inject(RegionService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock?.verify();
  });

  it('defaults to friuli-venezia-giulia when no region is stored', () => {
    setup(null);
    httpMock.expectOne(ENDPOINT).flush([]);
    expect(service.selectedRegion().id).toBe('friuli-venezia-giulia');
  });

  it('restores a valid persisted region', () => {
    setup('toscana');
    httpMock.expectOne(ENDPOINT).flush([]);
    expect(service.selectedRegion().id).toBe('toscana');
  });

  it('falls back to default for an unrecognised stored region id', () => {
    setup('not-a-real-region');
    httpMock.expectOne(ENDPOINT).flush([]);
    expect(service.selectedRegion().id).toBe('friuli-venezia-giulia');
  });

  it('exposes 20 static regions before the API responds', () => {
    setup(null);
    expect(service.regions().length).toBe(20);
    httpMock.expectOne(ENDPOINT).flush([]);
  });

  it('updates the regions list from the API response', () => {
    setup(null);
    const apiRegions = [
      { id: 'friuli-venezia-giulia', name: 'Friuli Venezia Giulia', group: 'NORD', hasKB: true },
      { id: 'toscana', name: 'Toscana', group: 'CENTRO', hasKB: false },
    ];
    httpMock.expectOne(ENDPOINT).flush(apiRegions);
    expect(service.regions().length).toBe(2);
  });

  it('normalises group to lowercase from the API response', () => {
    setup(null);
    httpMock.expectOne(ENDPOINT).flush([
      { id: 'friuli-venezia-giulia', name: 'Friuli Venezia Giulia', group: 'NORD', hasKB: true },
    ]);
    expect(service.regions()[0].group).toBe('nord');
  });

  it('re-resolves selectedRegion.hasKB from the API response', () => {
    setup(null); // friuli-venezia-giulia, hasKB: true from static list
    httpMock.expectOne(ENDPOINT).flush([
      { id: 'friuli-venezia-giulia', name: 'Friuli Venezia Giulia', group: 'NORD', hasKB: false },
    ]);
    expect(service.selectedRegion().hasKB).toBe(false);
  });

  it('keeps static regions when the API request errors', () => {
    setup(null);
    httpMock.expectOne(ENDPOINT).error(new ErrorEvent('network error'));
    expect(service.regions().length).toBe(20);
  });

  it('selectRegion updates selectedRegion and writes to localStorage', () => {
    setup(null);
    // Flush with a list that includes the target region so find() succeeds
    httpMock.expectOne(ENDPOINT).flush([
      { id: 'friuli-venezia-giulia', name: 'Friuli Venezia Giulia', group: 'NORD', hasKB: true },
      { id: 'toscana', name: 'Toscana', group: 'CENTRO', hasKB: false },
    ]);
    service.selectRegion('toscana');
    expect(service.selectedRegion().id).toBe('toscana');
    expect(localStorage.setItem).toHaveBeenCalledWith('italia-region', 'toscana');
  });

  it('selectRegion does nothing for an unrecognised id', () => {
    setup(null);
    httpMock.expectOne(ENDPOINT).flush([
      { id: 'friuli-venezia-giulia', name: 'Friuli Venezia Giulia', group: 'NORD', hasKB: true },
    ]);
    service.selectRegion('nonexistent');
    expect(service.selectedRegion().id).toBe('friuli-venezia-giulia');
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('selectedRegionHasKB reflects the selected region', () => {
    setup(null);
    httpMock.expectOne(ENDPOINT).flush([
      { id: 'friuli-venezia-giulia', name: 'Friuli Venezia Giulia', group: 'NORD', hasKB: true },
      { id: 'toscana', name: 'Toscana', group: 'CENTRO', hasKB: false },
    ]);
    expect(service.selectedRegionHasKB()).toBe(true); // friuli has KB
    service.selectRegion('toscana');
    expect(service.selectedRegionHasKB()).toBe(false);
  });
});
