import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION_NAME = 'italia-kb';
const EMBEDDING_MODEL = 'text-embedding-ada-002';

export interface ItaliaKBPayload {
  chunk_id: string;
  text: string;
  page_title: string;
  page_summary: string;
  category: string;
  region: string;
  source_url: string;
  source_file: string;
  section_title: string;
  links: { text: string; url: string }[];
  addresses: string[];
  image_urls: string[];
  opening_hours: string | null;
  prices: string | null;
  chunk_index: number;
  total_chunks_in_page: number;
}

export interface SearchResult {
  score: number;
  payload: ItaliaKBPayload;
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private readonly client: QdrantClient;
  private readonly openaiApiKey: string;

  constructor(private readonly config: ConfigService) {
    this.client = new QdrantClient({
      url: config.getOrThrow<string>('QDRANT_URL'),
      apiKey: config.getOrThrow<string>('QDRANT_API_KEY'),
    });
    this.openaiApiKey = config.getOrThrow<string>('OPENAI_API_KEY');
  }

  async onModuleInit() {
    try {
      const info = await this.client.getCollection(COLLECTION_NAME);
      this.logger.log(
        `Qdrant connected — collection "${COLLECTION_NAME}" has ${info.points_count} points`,
      );
    } catch (error) {
      this.logger.warn(`Qdrant collection check failed: ${error}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.getCollection(COLLECTION_NAME);
      return true;
    } catch {
      return false;
    }
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `OpenAI embeddings failed (HTTP ${res.status}): ${body.slice(0, 500)}`,
      );
    }

    const json = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
    };
    return json.data[0].embedding;
  }

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    const vector = await this.embed(query);

    const results = await this.client.search(COLLECTION_NAME, {
      vector,
      limit,
      score_threshold: 0.75,
      with_payload: true,
    });

    return results.map((r) => ({
      score: r.score,
      payload: r.payload as unknown as ItaliaKBPayload,
    }));
  }
}
