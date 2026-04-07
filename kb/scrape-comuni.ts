/**
 * Scrape the complete list of comuni for every Italian region from tuttitalia.it.
 *
 * Strategy: raw HTTP + cheerio (no headless browser = lighter footprint).
 * For each region → discover provinces → scrape each province's comuni page.
 *
 * Usage:
 *   npx tsx scrape-comuni.ts                     # All 20 regions
 *   npx tsx scrape-comuni.ts piemonte             # Single region
 *   npx tsx scrape-comuni.ts --skip-existing      # Skip regions that already have comuni.csv
 */

import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));

const JINA_PREFIX = 'https://r.jina.ai/';
const DELAY_BETWEEN_REGIONS_MS = 3000;
const DELAY_BETWEEN_REQUESTS_MS = 1500;
const MAX_RETRIES = 3;

const REGIONS = [
  'abruzzo', 'basilicata', 'calabria', 'campania', 'emilia-romagna',
  'friuli-venezia-giulia', 'lazio', 'liguria', 'lombardia', 'marche',
  'molise', 'piemonte', 'puglia', 'sardegna', 'sicilia', 'toscana',
  'trentino-alto-adige', 'umbria', 'valle-d-aosta', 'veneto',
];

const PROVINCE_CODES: Record<string, string> = {
  'agrigento': 'AG', 'alessandria': 'AL', 'ancona': 'AN', 'aosta': 'AO',
  'arezzo': 'AR', 'ascoli-piceno': 'AP', 'asti': 'AT', 'avellino': 'AV',
  'bari': 'BA', 'barletta-andria-trani': 'BT', 'belluno': 'BL', 'benevento': 'BN',
  'bergamo': 'BG', 'biella': 'BI', 'bologna': 'BO', 'bolzano': 'BZ',
  'brescia': 'BS', 'brindisi': 'BR', 'cagliari': 'CA', 'caltanissetta': 'CL',
  'campobasso': 'CB', 'caserta': 'CE', 'catania': 'CT', 'catanzaro': 'CZ',
  'chieti': 'CH', 'como': 'CO', 'cosenza': 'CS', 'cremona': 'CR',
  'crotone': 'KR', 'cuneo': 'CN', 'enna': 'EN', 'fermo': 'FM',
  'ferrara': 'FE', 'firenze': 'FI', 'foggia': 'FG', 'forli-cesena': 'FC',
  'frosinone': 'FR', 'genova': 'GE', 'gorizia': 'GO', 'grosseto': 'GR',
  'imperia': 'IM', 'isernia': 'IS', 'la-spezia': 'SP', 'latina': 'LT',
  'lecce': 'LE', 'lecco': 'LC', 'livorno': 'LI', 'lodi': 'LO',
  'lucca': 'LU', 'macerata': 'MC', 'mantova': 'MN', 'massa-carrara': 'MS',
  'matera': 'MT', 'messina': 'ME', 'milano': 'MI', 'modena': 'MO',
  'monza-e-della-brianza': 'MB', 'monza-della-brianza': 'MB',
  'napoli': 'NA', 'novara': 'NO', 'nuoro': 'NU',
  'oristano': 'OR', 'padova': 'PD', 'palermo': 'PA', 'parma': 'PR',
  'pavia': 'PV', 'perugia': 'PG', 'pesaro-e-urbino': 'PU', 'pescara': 'PE',
  'piacenza': 'PC', 'pisa': 'PI', 'pistoia': 'PT', 'pordenone': 'PN',
  'potenza': 'PZ', 'prato': 'PO', 'ragusa': 'RG', 'ravenna': 'RA',
  'reggio-calabria': 'RC', 'reggio-di-calabria': 'RC',
  'reggio-emilia': 'RE', 'reggio-nell-emilia': 'RE',
  'rieti': 'RI', 'rimini': 'RN', 'roma': 'RM', 'rovigo': 'RO',
  'salerno': 'SA', 'sassari': 'SS', 'savona': 'SV', 'siena': 'SI',
  'siracusa': 'SR', 'sondrio': 'SO', 'sud-sardegna': 'SU',
  'taranto': 'TA', 'teramo': 'TE', 'terni': 'TR', 'torino': 'TO',
  'trapani': 'TP', 'trento': 'TN', 'treviso': 'TV', 'trieste': 'TS',
  'udine': 'UD', 'varese': 'VA', 'venezia': 'VE', 'verbano-cusio-ossola': 'VB',
  'vercelli': 'VC', 'verona': 'VR', 'vibo-valentia': 'VV', 'vicenza': 'VI',
  'viterbo': 'VT',
  // Slug variants from tuttitalia
  'verbano-cusio-ossola': 'VB', 'pesaro-urbino': 'PU', 'aquila': 'AQ',
  'carbonia-iglesias': 'SU', 'olbia-tempio': 'SS',
  'medio-campidano': 'SU', 'ogliastra': 'NU',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  const jinaUrl = `${JINA_PREFIX}${url}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(jinaUrl, {
        headers: {
          'Accept': 'text/html',
          'X-Return-Format': 'html',
          'X-No-Cache': 'true',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const delay = 3000 * attempt + Math.random() * 2000;
      console.log(`    ↻ Retry ${attempt}/${MAX_RETRIES} (waiting ${Math.round(delay / 1000)}s)`);
      await sleep(delay);
    }
  }
  throw new Error('Unreachable');
}

/** Extract comuni names from a tuttitalia table.gwkz */
function extractComuniFromHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const names: string[] = [];

  $('table.gwkz tr').each((_, row) => {
    const td = $(row).find('td:first-child');
    if (td.length === 0) return;

    const text = td.text().trim();
    // Format: '1.NamePROV' (regional page) or '1.Name' (province page)
    const m = text.match(/^\d+\.(.+)/);
    if (!m) return;

    let name = m[1].trim();
    // Strip trailing 2-letter province code if present (regional page format: "Aiello del FriuliUD")
    // Only strip when the preceding text has lowercase letters (mixed case = regional page)
    // Province pages use ALL CAPS for capoluogo, so don't strip there to avoid
    // "CATANZARO" → "CATANZA" (stripping "RO" = Rovigo province code)
    const provSuffix = name.match(/^(.+?)([A-Z]{2})$/);
    if (provSuffix && provSuffix[1].match(/[a-z]/) && provSuffix[2].match(/^(AG|AL|AN|AO|AR|AP|AT|AV|BA|BT|BL|BN|BG|BI|BO|BZ|BS|BR|CA|CL|CB|CE|CT|CZ|CH|CO|CS|CR|KR|CN|EN|FM|FE|FI|FG|FC|FR|GE|GO|GR|IM|IS|SP|LT|LE|LC|LI|LO|LU|MC|MN|MS|MT|ME|MI|MO|MB|NA|NO|NU|OR|PD|PA|PR|PV|PG|PU|PE|PC|PI|PT|PN|PZ|PO|RG|RA|RC|RE|RI|RN|RM|RO|SA|SS|SV|SI|SR|SO|SU|TA|TE|TR|TO|TP|TN|TV|TS|UD|VA|VE|VB|VC|VR|VV|VI|VT)$/)) {
      name = provSuffix[1].trim();
    }

    // Fix all-caps capoluogo names
    if (name === name.toUpperCase() && name.length > 2) {
      name = name
        .split(/(\s+|')/)
        .map(w => {
          if (w.match(/^\s+$/) || w === "'") return w;
          if (w.length <= 2) return w.toLowerCase();
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join('');
    }

    if (name) names.push(name);
  });

  return names;
}

/** Discover province links from a region page */
function discoverProvinces(html: string, regionSlug: string): { name: string; code: string; url: string }[] {
  const $ = cheerio.load(html);
  const provinces: { name: string; code: string; url: string }[] = [];
  const seen = new Set<string>();

  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(new RegExp(`/${regionSlug}/provincia-(?:autonoma-)?(?:di-|del-|dell-|della-)([\\w-]+)/`));
    if (m && !seen.has(m[1])) {
      seen.add(m[1]);
      const code = PROVINCE_CODES[m[1]];
      if (!code) console.warn(`  ⚠ Unknown province slug: "${m[1]}"`);
      const fullUrl = href.startsWith('http') ? href : `https://www.tuttitalia.it${href}`;
      provinces.push({
        name: m[1],
        code: code || m[1].toUpperCase().slice(0, 2),
        url: fullUrl.replace(/\/$/, '') + '/',
      });
    }
  });

  return provinces;
}

/** Find the comuni list URL from a province overview page */
function findComuniUrl(html: string): string | null {
  const $ = cheerio.load(html);
  let comuniUrl: string | null = null;

  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('-comuni/popolazione') && !comuniUrl) {
      comuniUrl = href.startsWith('http') ? href : `https://www.tuttitalia.it${href}`;
    }
  });

  if (!comuniUrl) {
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('-comuni/') && !href.includes('sindaci') && !comuniUrl) {
        comuniUrl = href.startsWith('http') ? href : `https://www.tuttitalia.it${href}`;
      }
    });
  }

  return comuniUrl;
}

async function scrapeRegion(regionId: string): Promise<{ name: string; province: string }[]> {
  const allComuni: { name: string; province: string }[] = [];

  // Step 1: Load region page and discover provinces
  console.log(`  Discovering provinces...`);
  const regionHtml = await fetchPage(`https://www.tuttitalia.it/${regionId}/`);
  await sleep(DELAY_BETWEEN_REQUESTS_MS);

  const provinces = discoverProvinces(regionHtml, regionId);
  console.log(`  Found ${provinces.length} provinces: ${provinces.map(p => `${p.name} (${p.code})`).join(', ')}`);

  if (provinces.length === 0) {
    // Special handling for regions where province discovery fails
    if (regionId === 'trentino-alto-adige') {
      // Trentino uses "provincia-autonoma-di" not "provincia-di"
      provinces.push(
        { name: 'trento', code: 'TN', url: 'https://www.tuttitalia.it/trentino-alto-adige/provincia-autonoma-di-trento/' },
        { name: 'bolzano', code: 'BZ', url: 'https://www.tuttitalia.it/trentino-alto-adige/provincia-autonoma-di-bolzano/' },
      );
      console.log(`  Using hardcoded provinces for Trentino: TN, BZ`);
    } else {
      // Fallback: try regional comuni page directly
      console.log(`  No provinces, trying regional comuni page...`);
      const comuniUrl = findComuniUrl(regionHtml);
      if (comuniUrl) {
        const comuniHtml = await fetchPage(comuniUrl);
        const names = extractComuniFromHtml(comuniHtml);
        for (const name of names) allComuni.push({ name, province: 'AO' });
        console.log(`  AO (regional): ${names.length} comuni`);
      }
      return allComuni;
    }
  }

  // Step 2: For each province, find and scrape the comuni page
  for (const prov of provinces) {
    try {
      const provHtml = await fetchPage(prov.url);
      await sleep(DELAY_BETWEEN_REQUESTS_MS);

      const comuniUrl = findComuniUrl(provHtml);
      if (!comuniUrl) {
        console.log(`  ${prov.code} (${prov.name}): no comuni URL found`);
        continue;
      }

      const comuniHtml = await fetchPage(comuniUrl);
      await sleep(DELAY_BETWEEN_REQUESTS_MS);

      const names = extractComuniFromHtml(comuniHtml);
      for (const name of names) {
        allComuni.push({ name, province: prov.code });
      }
      console.log(`  ${prov.code} (${prov.name}): ${names.length} comuni`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ${prov.code} (${prov.name}): FAILED — ${msg}`);
    }
  }

  return allComuni;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const skipExisting = args.includes('--skip-existing');
  const regionFilter = args.find(a => !a.startsWith('--'));

  const regionsToScrape = regionFilter ? [regionFilter] : REGIONS;

  if (regionFilter && !REGIONS.includes(regionFilter)) {
    console.error(`Unknown region: ${regionFilter}`);
    console.error(`Available: ${REGIONS.join(', ')}`);
    process.exit(1);
  }

  const summary: { region: string; count: number }[] = [];

  for (const regionId of regionsToScrape) {
    const outPath = join(__dirname, regionId, 'comuni.csv');

    if (skipExisting && existsSync(outPath)) {
      console.log(`[${regionId}] SKIP (comuni.csv exists)`);
      continue;
    }

    console.log(`[${regionId}] Scraping...`);

    try {
      const comuni = await scrapeRegion(regionId);

      if (comuni.length === 0) {
        console.error(`  ⚠ 0 comuni found`);
        summary.push({ region: regionId, count: 0 });
        continue;
      }

      comuni.sort((a, b) => a.name.localeCompare(b.name, 'it'));

      let csv = 'name,province\n';
      for (const c of comuni) {
        csv += `${c.name},${c.province}\n`;
      }

      writeFileSync(outPath, csv, 'utf-8');
      console.log(`  ✓ Saved ${comuni.length} comuni`);
      summary.push({ region: regionId, count: comuni.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ FAILED: ${msg}`);
      summary.push({ region: regionId, count: -1 });
    }

    await sleep(DELAY_BETWEEN_REGIONS_MS);
  }

  // Summary
  console.log('\n========== Summary ==========');
  let total = 0;
  for (const s of summary) {
    const status = s.count < 0 ? 'FAILED' : `${s.count} comuni`;
    console.log(`  ${s.region}: ${status}`);
    if (s.count > 0) total += s.count;
  }
  console.log(`\nTotal: ${total} comuni across ${summary.filter(s => s.count > 0).length} regions`);
}

main().catch(console.error);
