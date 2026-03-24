import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatConversationService } from './chat-conversation.service';
import {
  CreateConversationDto,
  AppendMessageDto,
  UpdateTitleDto,
  ListConversationsQueryDto,
} from './dto/chat-conversation.dto';

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ChatConversationController {
  private readonly logger = new Logger(ChatConversationController.name);

  constructor(private readonly conversationService: ChatConversationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  async create(@Body() dto: CreateConversationDto, @Request() req: any) {
    return this.conversationService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List conversations for the authenticated user' })
  async list(@Query() query: ListConversationsQueryDto, @Request() req: any) {
    return this.conversationService.listForUser(req.user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation with all messages' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.conversationService.findOne(id, req.user.id);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Append a message to a conversation' })
  async appendMessage(
    @Param('id') id: string,
    @Body() dto: AppendMessageDto,
    @Request() req: any,
  ) {
    return this.conversationService.appendMessage(id, req.user.id, dto);
  }

  @Patch(':id/title')
  @ApiOperation({ summary: 'Update conversation title' })
  async updateTitle(
    @Param('id') id: string,
    @Body() dto: UpdateTitleDto,
    @Request() req: any,
  ) {
    return this.conversationService.updateTitle(id, req.user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation' })
  async delete(@Param('id') id: string, @Request() req: any) {
    await this.conversationService.delete(id, req.user.id);
  }
}
