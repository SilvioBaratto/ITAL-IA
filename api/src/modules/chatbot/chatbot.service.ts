import { Injectable, Logger } from '@nestjs/common';
import { QdrantService, SearchResult } from '../qdrant/qdrant.service';
import { ItineraryService } from '../itinerary/itinerary.service';
import { ChatRequestDto, RichChatResponseDto, StreamChunkDto } from './dto/chat.dto';

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

const EMPTY_RICH: RichChatResponseDto = {
  text: '',
  images: [],
  links: [],
  map_links: [],
  tables: [],
  sources: [],
};

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly qdrantService: QdrantService,
    private readonly itineraryService: ItineraryService,
  ) {}

  async chat(request: ChatRequestDto, userId?: string): Promise<RichChatResponseDto> {
    try {
      const { b } = await import('../../../baml_client');
      const region = request.region ?? DEFAULT_REGION;

      const [searchResults, tripContext] = await Promise.all([
        this.qdrantService.search(request.user_question, 5, request.region),
        userId ? this.getUserTripContext(userId) : Promise.resolve(null),
      ]);
      const contextChunks = toRetrievedChunks(searchResults);

      const result = await b.RAGChat(
        request.user_question,
        contextChunks,
        request.conversation_history,
        tripContext,
        region,
      );

      return {
        text: result.text ?? '',
        images: result.images ?? [],
        links: result.links ?? [],
        map_links: result.map_links ?? [],
        tables: result.tables ?? [],
        sources: result.sources ?? [],
      };
    } catch (error) {
      this.logger.error(`Chat error: ${error}`);
      return {
        ...EMPTY_RICH,
        text: 'Mi dispiace, si è verificato un errore. Riprova più tardi.',
      };
    }
  }

  async *streamChat(
    request: ChatRequestDto,
    userId?: string,
  ): AsyncGenerator<StreamChunkDto> {
    try {
      const { b } = await import('../../../baml_client');
      const region = request.region ?? DEFAULT_REGION;

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

  private async getUserTripContext(userId: string): Promise<string | null> {
    try {
      const trip = await this.itineraryService.getMostRecentTrip(userId);
      if (!trip) return null;
      return this.formatTripContext(trip);
    } catch (error) {
      this.logger.warn(`Failed to fetch trip context for user ${userId}: ${error}`);
      return null;
    }
  }

  private formatTripContext(trip: any): string {
    const lines: string[] = [];
    lines.push(`**Viaggio:** ${trip.title}`);
    lines.push(`**Città:** ${trip.city}`);
    lines.push(`**Date:** ${trip.startDate} – ${trip.endDate}`);
    lines.push('');

    for (const day of trip.days) {
      lines.push(`### Giorno ${day.dayNumber}: ${day.title}`);
      if (day.theme) lines.push(`*Tema: ${day.theme}*`);

      for (const activity of day.activities) {
        const time = activity.startTime
          ? activity.endTime
            ? `${activity.startTime}–${activity.endTime}`
            : activity.startTime
          : '';
        const price =
          activity.priceMinCents != null || activity.priceMaxCents != null
            ? ` | Prezzo: €${((activity.priceMinCents ?? activity.priceMaxCents ?? 0) / 100).toFixed(0)}`
            : '';
        const place = activity.place
          ? ` | Luogo: ${activity.place.name}${activity.place.address ? `, ${activity.place.address}` : ''}`
          : '';

        lines.push(`- [${activity.activityType}] ${time ? time + ' ' : ''}**${activity.title}**${place}${price}`);
        if (activity.description) lines.push(`  ${activity.description}`);
        if (activity.highlights?.length) {
          lines.push(`  Punti salienti: ${activity.highlights.map((h: any) => h.description).join(', ')}`);
        }
      }
      lines.push('');
    }

    if (trip.bookings?.length) {
      lines.push('### Prenotazioni');
      for (const b of trip.bookings) {
        const price = b.priceCents != null ? ` – €${(b.priceCents / 100).toFixed(0)}` : '';
        lines.push(`- ${b.attractionName}${price}${b.bookingUrl ? ` (${b.bookingUrl})` : ''}`);
      }
      lines.push('');
    }

    if (trip.tips?.length) {
      lines.push('### Consigli di viaggio');
      for (const tip of trip.tips) {
        lines.push(`- [${tip.category}] ${tip.content}`);
      }
    }

    return lines.join('\n');
  }
}
