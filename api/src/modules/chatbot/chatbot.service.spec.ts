jest.mock('../../../baml_client', () => ({
  b: {
    stream: {
      StreamRAGChat: jest.fn(),
    },
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotService } from './chatbot.service';
import { QdrantService } from '../qdrant/qdrant.service';

type MockedBaml = { b: { stream: { StreamRAGChat: jest.Mock } } };
const mockStreamRAGChat = (jest.requireMock('../../../baml_client') as MockedBaml).b.stream.StreamRAGChat;

const mockQdrantService = {
  search: jest.fn(),
};

function makeSearchResult(text = 'Sample text') {
  return {
    score: 0.9,
    payload: {
      text,
      page_title: 'Test Page',
      section_title: 'Test Section',
      source_url: 'https://example.com',
      links: [],
      addresses: [],
      image_urls: [],
      opening_hours: null,
      prices: null,
    },
  };
}

function makeFinalResponse() {
  return {
    text: 'Final response text',
    images: [],
    links: [],
    map_links: [],
    tables: [],
    sources: [],
    item_categories: [],
  };
}

function makeMockStream(events: object[], finalResponse: object) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        yield event;
      }
    },
    getFinalResponse: jest.fn().mockResolvedValue(finalResponse),
  };
}

describe('ChatbotService', () => {
  let service: ChatbotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotService,
        { provide: QdrantService, useValue: mockQdrantService },
      ],
    }).compile();

    service = module.get<ChatbotService>(ChatbotService);
    jest.clearAllMocks();
  });

  describe('streamChat', () => {
    it('should call QdrantService.search with the user question and region', async () => {
      mockStreamRAGChat.mockReturnValue(makeMockStream([], makeFinalResponse()));
      mockQdrantService.search.mockResolvedValue([]);

      for await (const _ of service.streamChat({
        user_question: 'What to eat in Trieste?',
        region: 'Friuli Venezia Giulia',
      })) { /* drain */ }

      expect(mockQdrantService.search).toHaveBeenCalledWith(
        'What to eat in Trieste?',
        5,
        'Friuli Venezia Giulia',
      );
    });

    it('should default to Friuli Venezia Giulia when no region is provided', async () => {
      mockStreamRAGChat.mockReturnValue(makeMockStream([], makeFinalResponse()));
      mockQdrantService.search.mockResolvedValue([]);

      for await (const _ of service.streamChat({ user_question: 'Test question' })) { /* drain */ }

      expect(mockStreamRAGChat).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        undefined,
        null,
        'Friuli Venezia Giulia',
      );
    });

    it('should yield partial chunks for each BAML stream event', async () => {
      const events = [{ text: 'Ciao' }, { text: 'Ciao mondo' }];
      mockStreamRAGChat.mockReturnValue(makeMockStream(events, makeFinalResponse()));
      mockQdrantService.search.mockResolvedValue([]);

      const chunks: object[] = [];
      for await (const chunk of service.streamChat({ user_question: 'Test' })) {
        chunks.push(chunk);
      }

      // 2 partial + 1 complete
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toMatchObject({ type: 'partial', done: false, data: { text: 'Ciao' } });
      expect(chunks[1]).toMatchObject({ type: 'partial', done: false, data: { text: 'Ciao mondo' } });
    });

    it('should yield a final complete chunk with done=true', async () => {
      const finalResponse = makeFinalResponse();
      mockStreamRAGChat.mockReturnValue(makeMockStream([], finalResponse));
      mockQdrantService.search.mockResolvedValue([]);

      const chunks: object[] = [];
      for await (const chunk of service.streamChat({ user_question: 'Test' })) {
        chunks.push(chunk);
      }

      const last = chunks[chunks.length - 1] as Record<string, unknown>;
      expect(last.type).toBe('complete');
      expect(last.done).toBe(true);
      expect((last.data as Record<string, unknown>).text).toBe('Final response text');
      expect((last.data as Record<string, unknown>).images).toEqual([]);
    });

    it('should yield an error chunk when QdrantService.search throws', async () => {
      mockQdrantService.search.mockRejectedValue(new Error('Qdrant unavailable'));

      const chunks: object[] = [];
      for await (const chunk of service.streamChat({ user_question: 'Test' })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({ type: 'error', done: true });
    });

    it('should yield an error chunk when the BAML stream throws', async () => {
      mockQdrantService.search.mockResolvedValue([]);
      mockStreamRAGChat.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('BAML stream failure');
        },
        getFinalResponse: jest.fn(),
      });

      const chunks: object[] = [];
      for await (const chunk of service.streamChat({ user_question: 'Test' })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({ type: 'error', done: true });
    });

    it('should pass conversation_history to BAML when provided', async () => {
      const history = { messages: ['prev message'] };
      mockStreamRAGChat.mockReturnValue(makeMockStream([], makeFinalResponse()));
      mockQdrantService.search.mockResolvedValue([]);

      for await (const _ of service.streamChat({
        user_question: 'Test',
        conversation_history: history,
      })) { /* drain */ }

      expect(mockStreamRAGChat).toHaveBeenCalledWith(
        'Test',
        expect.any(Array),
        history,
        null,
        'Friuli Venezia Giulia',
      );
    });

    it('should map search results to context chunks passed to BAML', async () => {
      const searchResult = makeSearchResult('Trieste history');
      mockStreamRAGChat.mockReturnValue(makeMockStream([], makeFinalResponse()));
      mockQdrantService.search.mockResolvedValue([searchResult]);

      for await (const _ of service.streamChat({ user_question: 'Test' })) { /* drain */ }

      expect(mockStreamRAGChat).toHaveBeenCalledWith(
        'Test',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Trieste history', relevance_score: 0.9 }),
        ]),
        undefined,
        null,
        'Friuli Venezia Giulia',
      );
    });
  });
});
