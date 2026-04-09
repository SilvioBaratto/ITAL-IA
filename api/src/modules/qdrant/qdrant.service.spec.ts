import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QdrantService } from './qdrant.service';

describe('QdrantService', () => {
  let service: QdrantService;
  let mockSearch: jest.Mock;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        QdrantService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              const env: Record<string, string> = {
                QDRANT_URL: 'http://localhost:6333',
                QDRANT_API_KEY: 'test-key',
                QDRANT_COLLECTION_NAME: 'italia-kb',
                QDRANT_SCORE_THRESHOLD: '0.75',
                QDRANT_SEARCH_LIMIT: '5',
                AZURE_OPENAI_EMBEDDINGS_ENDPOINT:
                  'https://westeurope.api.cognitive.microsoft.com/',
                AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT: 'text-embedding-3-large',
                AZURE_OPENAI_EMBEDDINGS_API_VERSION: '2024-02-01',
                AZURE_OPENAI_EMBEDDINGS_API_KEY: 'test-azure-key',
                AZURE_OPENAI_EMBEDDINGS_DIM: '3072',
              };
              return env[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(QdrantService);

    // Mock embed to avoid real Azure OpenAI calls
    jest.spyOn(service, 'embed').mockResolvedValue(new Array(3072).fill(0));

    // Mock the internal Qdrant client search
    mockSearch = jest.fn().mockResolvedValue([
      {
        score: 0.9,
        payload: {
          chunk_id: '1',
          text: 'Test text',
          page_title: 'Test',
          page_summary: '',
          category: 'culture',
          region: 'Friuli Venezia Giulia',
          source_url: 'https://example.com',
          source_file: 'test.md',
          section_title: 'Test Section',
          links: [],
          addresses: [],
          image_urls: [],
          opening_hours: null,
          prices: null,
          chunk_index: 0,
          total_chunks_in_page: 1,
        },
      },
    ]);
    (service as any).client.search = mockSearch;
  });

  it('should search without filter when no region is provided', async () => {
    await service.search('test query', 5);

    expect(mockSearch).toHaveBeenCalledWith(
      'italia-kb',
      expect.objectContaining({
        limit: 5,
        score_threshold: 0.75,
        with_payload: true,
        filter: undefined,
      }),
    );
  });

  it('should search with region filter when region is provided', async () => {
    await service.search('test query', 5, 'Friuli Venezia Giulia');

    expect(mockSearch).toHaveBeenCalledWith(
      'italia-kb',
      expect.objectContaining({
        limit: 5,
        score_threshold: 0.75,
        with_payload: true,
        filter: {
          must: [{ key: 'region', match: { value: 'Friuli Venezia Giulia' } }],
        },
      }),
    );
  });

  it('should return mapped results with score and payload', async () => {
    const results = await service.search('test query', 5, 'Friuli Venezia Giulia');

    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.9);
    expect(results[0].payload.region).toBe('Friuli Venezia Giulia');
    expect(results[0].payload.text).toBe('Test text');
  });
});
