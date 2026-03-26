import { Injectable, Logger } from '@nestjs/common';
import { QdrantService, SearchResult } from '../qdrant/qdrant.service';
import { ChatRequestDto, ItemCategoryMapSchema, StreamChunkDto } from './dto/chat.dto';
import { z } from 'zod';

type ItemCategoryMap = z.infer<typeof ItemCategoryMapSchema>;

const DEFAULT_REGION = 'Friuli Venezia Giulia';

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
      const region = request.region ?? DEFAULT_REGION;

      const requestDatetime = buildRequestDatetime();

      const [searchResults, tripContext] = await Promise.all([
        this.qdrantService.search(request.user_question, 5, request.region),
        userId ? this.getUserTripContext(userId) : Promise.resolve(null),
      ]);
      const contextChunks = toRetrievedChunks(searchResults);

      const stream = b.stream.StreamRAGChat(
        request.user_question,
        contextChunks,
        request.conversation_history,
        tripContext,
        region,
        requestDatetime,
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
