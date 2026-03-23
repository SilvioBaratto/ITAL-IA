import { Controller, Post, Get, Body, Res, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ChatbotService } from './chatbot.service';
import { ChatRequestDto, RichChatResponseDto } from './dto/chat.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Chatbot')
@ApiBearerAuth()
@Controller('chat')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post()
  @ApiOperation({ summary: 'Send a chat message' })
  async chat(
    @Body() chatRequest: ChatRequestDto,
    @Request() req: any,
  ): Promise<RichChatResponseDto> {
    return this.chatbotService.chat(chatRequest, req.user?.id);
  }

  @Post('stream')
  @ApiOperation({ summary: 'Stream a chat response (SSE)' })
  async streamChat(
    @Body() chatRequest: ChatRequestDto,
    @Res() res: Response,
    @Request() req: any,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const chunk of this.chatbotService.streamChat(chatRequest, req.user?.id)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', data: { text: 'Error generating response' }, done: true })}\n\n`,
      );
      res.end();
    }
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Chatbot health check' })
  health() {
    return { status: 'ok', service: 'chatbot' };
  }
}
