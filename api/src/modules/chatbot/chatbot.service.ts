import { Injectable, Logger } from '@nestjs/common';
import { QdrantService, SearchResult } from '../qdrant/qdrant.service';
import { ChatRequestDto, ItemCategoryMapSchema, StreamChunkDto } from './dto/chat.dto';
import type { QueryClassification } from '../../../baml_client/types';
import { z } from 'zod';

type ItemCategoryMap = z.infer<typeof ItemCategoryMapSchema>;

/**
 * Slug → display name for the 20 Italian regions. Kept inline rather than
 * fetched from Prisma because (a) the list is stable, (b) this runs on every
 * chat turn and we don't want an extra DB round-trip, and (c) Region.name
 * in the DB must match these values anyway (they're seeded from the same
 * source of truth).
 */
const REGION_DISPLAY_NAMES: Record<string, string> = {
  piemonte: 'Piemonte',
  'valle-d-aosta': "Valle d'Aosta",
  lombardia: 'Lombardia',
  'trentino-alto-adige': 'Trentino-Alto Adige',
  veneto: 'Veneto',
  'friuli-venezia-giulia': 'Friuli Venezia Giulia',
  liguria: 'Liguria',
  'emilia-romagna': 'Emilia-Romagna',
  toscana: 'Toscana',
  umbria: 'Umbria',
  marche: 'Marche',
  lazio: 'Lazio',
  abruzzo: 'Abruzzo',
  molise: 'Molise',
  campania: 'Campania',
  puglia: 'Puglia',
  basilicata: 'Basilicata',
  calabria: 'Calabria',
  sicilia: 'Sicilia',
  sardegna: 'Sardegna',
};

const DEFAULT_REGION_SLUG = 'friuli-venezia-giulia';

/**
 * Normalize whatever the frontend sends into the canonical slug form stored
 * in Qdrant payloads. Accepts either `"friuli-venezia-giulia"` or
 * `"Friuli Venezia Giulia"` and returns the slug. Falls back to the default
 * region slug if the input is missing or unrecognized.
 *
 * The slug form matters: Qdrant stores `region: 'friuli-venezia-giulia'`
 * in each payload, and a filter with the display name silently matches
 * nothing. Before this helper existed, the chatbot got lucky because the
 * collection was ~100% one region — with multi-region data it would have
 * been a real bug.
 */
function toRegionSlug(input: string | undefined): string {
  if (!input) return DEFAULT_REGION_SLUG;

  // Already a slug (lowercase, hyphens, no spaces)
  if (/^[a-z]+(-[a-z]+)*$/.test(input)) {
    return input in REGION_DISPLAY_NAMES ? input : DEFAULT_REGION_SLUG;
  }

  // Display name form — normalize: lowercase, strip accents, replace
  // apostrophes and spaces with hyphens. Covers "Valle d'Aosta" → "valle-d-aosta"
  // and "Emilia-Romagna" → "emilia-romagna".
  const normalized = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized in REGION_DISPLAY_NAMES ? normalized : DEFAULT_REGION_SLUG;
}

function regionDisplayName(slug: string): string {
  return REGION_DISPLAY_NAMES[slug] ?? 'Italia';
}

/**
 * Serialize the last few turns of conversation into a plain-text block for
 * the classifier prompt. We only pass recent context because older turns
 * rarely change category intent — the classifier needs to handle
 * follow-ups like "e a Udine?" which only make sense with the immediately
 * preceding question.
 */
function serializeRecentHistory(
  history: { messages: string[] } | undefined,
  lastN = 6,
): string {
  if (!history?.messages || history.messages.length === 0) return '';
  return history.messages.slice(-lastN).join('\n');
}

function toRetrievedChunks(results: SearchResult[]) {
  return results.map((r) => ({
    text: r.payload.text,
    page_title: r.payload.page_title,
    section_title: r.payload.section_title,
    source_url: r.payload.source_url,
    links: JSON.stringify(r.payload.links ?? []),
    addresses: (r.payload.addresses ?? []).join(', '),
    image_urls: (r.payload.image_urls ?? []).join(', '),
    opening_hours: r.payload.opening_hours ?? null,
    prices: r.payload.prices ?? null,
    relevance_score: r.score,
  }));
}

function buildRequestDatetime(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('it-IT', {
    timeZone: 'Europe/Rome',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
  });
  const hour = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome', hour: 'numeric', hour12: false }),
    10,
  );
  let fascia: string;
  if (hour >= 6 && hour < 12) fascia = 'mattina';
  else if (hour >= 12 && hour < 14) fascia = 'mezzogiorno';
  else if (hour >= 14 && hour < 19) fascia = 'pomeriggio';
  else if (hour >= 19 && hour < 23) fascia = 'sera';
  else fascia = 'notte';
  return `${dateStr}, ore ${timeStr} (${fascia})`;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(private readonly qdrantService: QdrantService) {}

  async *streamChat(
    request: ChatRequestDto,
    userId?: string,
  ): AsyncGenerator<StreamChunkDto> {
    try {
      const { b } = await import('../../../baml_client');

      // Normalize region up front so slug (for Qdrant) and display name
      // (for LLM prompts) come from a single source of truth.
      const regionSlug = toRegionSlug(request.region);
      const regionDisplay = regionDisplayName(regionSlug);

      const requestDatetime = buildRequestDatetime();
      const recentHistory = serializeRecentHistory(request.conversation_history);

      // Classify the question in parallel with the trip-context fetch.
      // The Qdrant search is gated on the classification result so it runs
      // sequentially after, but at least the slower DB-free classifier and
      // the DB-bound trip context overlap.
      const classifierFallback: QueryClassification = {
        categories: [],
        comune: null,
      };

      const [classification, tripContext] = await Promise.all([
        b
          .ClassifyQuery(request.user_question, regionDisplay, recentHistory)
          .catch((err): QueryClassification => {
            // Classifier is a soft dependency. If it fails for any reason
            // (Azure blip, parse error), fall back to an unfiltered search
            // so the chat still works — degraded, not dead.
            this.logger.warn(`ClassifyQuery failed, proceeding unfiltered: ${err}`);
            return classifierFallback;
          }),
        userId ? this.getUserTripContext(userId) : Promise.resolve(null),
      ]);

      // Effective comune precedence: explicit mention in the question
      // beats the user's current geolocation. Someone sitting in Trieste
      // who asks "ristoranti a Udine?" wants Udine results.
      const effectiveComune =
        (classification.comune && classification.comune.trim().length > 0
          ? classification.comune.trim()
          : request.comune_name) ?? undefined;

      this.logger.debug(
        `ClassifyQuery → region=${regionSlug} ` +
          `categories=[${(classification.categories ?? []).join(',')}] ` +
          `comune=${effectiveComune ?? 'null'}`,
      );

      // Cast category enum values to plain strings for the Qdrant filter.
      // Qdrant stores `category` as a plain string in the payload, so a
      // match against the BAML enum value works directly — the enum
      // members and the Prisma `poi_category` values are identical by design.
      const categoryFilter = (classification.categories ?? []).map((c) => String(c));

      const searchResults = await this.qdrantService.search(
        request.user_question,
        5,
        regionSlug,
        categoryFilter.length > 0 ? categoryFilter : undefined,
        effectiveComune,
      );
      const contextChunks = toRetrievedChunks(searchResults);

      const userLocationStr = request.comune_name
        ? `L'utente si trova a ${request.comune_name}`
        : request.user_location
          ? `Lat ${request.user_location.latitude.toFixed(5)}, Lon ${request.user_location.longitude.toFixed(5)} (precisione: ~${Math.round(request.user_location.accuracy)}m)`
          : null;

      const stream = b.stream.StreamRAGChat(
        request.user_question,
        contextChunks,
        request.conversation_history,
        tripContext,
        regionDisplay,
        requestDatetime,
        userLocationStr,
      );

      for await (const event of stream) {
        yield {
          type: 'partial',
          data: {
            text: event?.text ?? undefined,
            images: event?.images ?? undefined,
            links: event?.links ?? undefined,
            map_links: event?.map_links ?? undefined,
            tables: event?.tables ?? undefined,
            sources: event?.sources ?? undefined,
            item_categories: (event?.item_categories ?? undefined) as ItemCategoryMap[] | undefined,
          },
          done: false,
        };
      }

      const final = await stream.getFinalResponse();
      yield {
        type: 'complete',
        data: {
          text: final.text ?? '',
          images: final.images ?? [],
          links: final.links ?? [],
          map_links: final.map_links ?? [],
          tables: final.tables ?? [],
          sources: final.sources ?? [],
          item_categories: (final.item_categories ?? []) as ItemCategoryMap[],
        },
        done: true,
      };
    } catch (error) {
      this.logger.error(`Stream chat error: ${error}`);
      yield {
        type: 'error',
        data: {
          text: 'Mi dispiace, si è verificato un errore. Riprova più tardi.',
        },
        done: true,
      };
    }
  }

  private getUserTripContext(_userId: string): Promise<null> {
    return Promise.resolve(null);
  }
}
