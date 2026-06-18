/**
 * Region card images — one iconic photo per Italian region.
 * Self-hosted under src/assets/regions/{slug}.webp (served at /assets/regions/).
 *
 * Originally hotlinked from Wikimedia Commons, but Wikimedia disabled on-demand
 * thumbnail generation for hotlinkers (arbitrary widths now return HTTP 400/429),
 * so the images are downloaded and bundled locally instead. Encoded as WebP at
 * 480px width (cards render at <=192px CSS, so 480px covers ~2.5x DPR) — every
 * file is 9-34 KB for near-instant rendering in any modern browser.
 * Source photos: Wikimedia Commons (CC-BY-SA / public domain).
 */
const REGION_IMAGES: Record<string, string> = {
  'piemonte':              '/assets/regions/piemonte.webp',
  'valle-d-aosta':         '/assets/regions/valle-d-aosta.webp',
  'lombardia':             '/assets/regions/lombardia.webp',
  'trentino-alto-adige':   '/assets/regions/trentino-alto-adige.webp',
  'veneto':                '/assets/regions/veneto.webp',
  'friuli-venezia-giulia': '/assets/regions/friuli-venezia-giulia.webp',
  'liguria':               '/assets/regions/liguria.webp',
  'emilia-romagna':        '/assets/regions/emilia-romagna.webp',
  'toscana':               '/assets/regions/toscana.webp',
  'umbria':                '/assets/regions/umbria.webp',
  'marche':                '/assets/regions/marche.webp',
  'lazio':                 '/assets/regions/lazio.webp',
  'abruzzo':               '/assets/regions/abruzzo.webp',
  'molise':                '/assets/regions/molise.webp',
  'campania':              '/assets/regions/campania.webp',
  'puglia':                '/assets/regions/puglia.webp',
  'basilicata':            '/assets/regions/basilicata.webp',
  'calabria':              '/assets/regions/calabria.webp',
  'sicilia':               '/assets/regions/sicilia.webp',
  'sardegna':              '/assets/regions/sardegna.webp',
};

export function getRegionImageUrl(regionId: string): string {
  return REGION_IMAGES[regionId] ?? '';
}
