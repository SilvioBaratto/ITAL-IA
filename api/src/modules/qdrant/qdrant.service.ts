import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface ItaliaKBPayload {
  chunk_id: string;
  text: string;
  page_title: string;
  page_summary: string;
  category: string;
  region: string;
  comune_name: string;
  province: string | null;
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
  private readonly collectionName: string;
  private readonly scoreThreshold: number;
  private readonly defaultSearchLimit: number;
  private readonly vectorSize: number;
  private readonly azureEmbedUrl: string;
  private readonly azureEmbedKey: string;

  constructor(private readonly config: ConfigService) {
    this.client = new QdrantClient({
      url: config.getOrThrow<string>('QDRANT_URL'),
      apiKey: config.getOrThrow<string>('QDRANT_API_KEY'),
    });

    this.collectionName = config.getOrThrow<string>('QDRANT_COLLECTION_NAME');
    this.scoreThreshold = parseFloat(
      config.getOrThrow<string>('QDRANT_SCORE_THRESHOLD'),
    );
    this.defaultSearchLimit = parseInt(
      config.getOrThrow<string>('QDRANT_SEARCH_LIMIT'),
      10,
    );
    this.vectorSize = parseInt(
      config.getOrThrow<string>('AZURE_OPENAI_EMBEDDINGS_DIM'),
      10,
    );

    if (Number.isNaN(this.scoreThreshold)) {
      throw new Error('QDRANT_SCORE_THRESHOLD must be a number');
    }
    if (Number.isNaN(this.defaultSearchLimit)) {
      throw new Error('QDRANT_SEARCH_LIMIT must be an integer');
    }
    if (Number.isNaN(this.vectorSize)) {
      throw new Error('AZURE_OPENAI_EMBEDDINGS_DIM must be an integer');
    }

    const endpoint = config
      .getOrThrow<string>('AZURE_OPENAI_EMBEDDINGS_ENDPOINT')
      .replace(/\/+$/, '');
    const deployment = config.getOrThrow<string>(
      'AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT',
    );
    const apiVersion = config.getOrThrow<string>(
      'AZURE_OPENAI_EMBEDDINGS_API_VERSION',
    );
    this.azureEmbedUrl = `${endpoint}/openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`;
    this.azureEmbedKey = config.getOrThrow<string>(
      'AZURE_OPENAI_EMBEDDINGS_API_KEY',
    );
  }

  async onModuleInit() {
    try {
      const info = await this.client.getCollection(this.collectionName);
      this.logger.log(
        `Qdrant connected — collection "${this.collectionName}" has ${info.points_count} points`,
      );
    } catch (error) {
      this.logger.warn(`Qdrant collection check failed: ${error}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.getCollection(this.collectionName);
      return true;
    } catch {
      return false;
    }
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(this.azureEmbedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.azureEmbedKey,
      },
      body: JSON.stringify({ input: text }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Azure OpenAI embeddings failed (HTTP ${res.status}): ${body.slice(0, 500)}`,
      );
    }

    const json = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
    };
    const embedding = json.data[0].embedding;

    if (embedding.length !== this.vectorSize) {
      throw new Error(
        `Embedding dimension mismatch: got ${embedding.length}, expected ${this.vectorSize} (AZURE_OPENAI_EMBEDDINGS_DIM)`,
      );
    }

    return embedding;
  }

  async search(
    query: string,
    limit: number = this.defaultSearchLimit,
    region?: string,
    categories?: string[],
    comuneName?: string,
  ): Promise<SearchResult[]> {
    const vector = await this.embed(query);

    // Build filter incrementally. An empty must[] means no filter at all;
    // Qdrant treats a missing `filter` field differently from `filter: { must: [] }`,
    // so we only attach the filter object when there's actually something to constrain.
    const must: Record<string, unknown>[] = [];
    if (region) {
      must.push({ key: 'region', match: { value: region } });
    }
    if (categories && categories.length > 0) {
      // `match: { any: [...] }` is the OR-over-values form for keyword fields.
      must.push({ key: 'category', match: { any: categories } });
    }
    if (comuneName) {
      must.push({ key: 'comune_name', match: { value: comuneName } });
    }

    const filter = must.length > 0 ? { must } : undefined;

    const results = await this.client.search(this.collectionName, {
      vector,
      limit,
      score_threshold: this.scoreThreshold,
      with_payload: true,
      filter,
    });

    return results.map((r) => ({
      score: r.score,
      payload: r.payload as unknown as ItaliaKBPayload,
    }));
  }
}
