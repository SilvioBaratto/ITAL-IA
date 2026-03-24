import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';

const mockChatbotService = {
  streamChat: jest.fn(),
};

function mockRes() {
  return {
    setHeader: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  };
}

describe('ChatbotController', () => {
  let controller: ChatbotController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatbotController],
      providers: [{ provide: ChatbotService, useValue: mockChatbotService }],
    }).compile();

    controller = module.get<ChatbotController>(ChatbotController);
    jest.clearAllMocks();
  });

  describe('streamChat', () => {
    it('should set SSE headers', async () => {
      async function* empty() { /* no chunks */ }
      mockChatbotService.streamChat.mockReturnValue(empty());
      const res = mockRes();

      await controller.streamChat({} as any, res as any, { user: { id: 'u1' } });

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    });

    it('should write each chunk as a JSON SSE data line', async () => {
      const chunk = { type: 'complete', data: { text: 'Ciao' }, done: true };
      async function* withChunk() { yield chunk; }
      mockChatbotService.streamChat.mockReturnValue(withChunk());
      const res = mockRes();

      await controller.streamChat({} as any, res as any, { user: { id: 'u1' } });

      expect(res.write).toHaveBeenCalledWith(`data: ${JSON.stringify(chunk)}\n\n`);
    });

    it('should call res.end() after all chunks are consumed', async () => {
      async function* empty() { /* no chunks */ }
      mockChatbotService.streamChat.mockReturnValue(empty());
      const res = mockRes();

      await controller.streamChat({} as any, res as any, { user: { id: 'u1' } });

      expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('should write error SSE event and call res.end() when service throws', async () => {
      mockChatbotService.streamChat.mockImplementation(() => {
        throw new Error('Service failure');
      });
      const res = mockRes();

      await controller.streamChat({} as any, res as any, { user: { id: 'u1' } });

      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"'),
      );
      expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('should pass req.user.id to ChatbotService.streamChat', async () => {
      async function* empty() { /* no chunks */ }
      mockChatbotService.streamChat.mockReturnValue(empty());

      await controller.streamChat(
        { user_question: 'Test' } as any,
        mockRes() as any,
        { user: { id: 'user-123' } },
      );

      expect(mockChatbotService.streamChat).toHaveBeenCalledWith(
        { user_question: 'Test' },
        'user-123',
      );
    });

    it('should pass undefined userId when req.user is absent', async () => {
      async function* empty() { /* no chunks */ }
      mockChatbotService.streamChat.mockReturnValue(empty());

      await controller.streamChat(
        { user_question: 'Test' } as any,
        mockRes() as any,
        {},
      );

      expect(mockChatbotService.streamChat).toHaveBeenCalledWith(
        { user_question: 'Test' },
        undefined,
      );
    });
  });

  describe('health', () => {
    it('should return { status: ok, service: chatbot }', () => {
      expect(controller.health()).toEqual({ status: 'ok', service: 'chatbot' });
    });
  });
});
