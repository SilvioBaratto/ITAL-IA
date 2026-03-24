import { Module } from '@nestjs/common';
import { ChatConversationController } from './chat-conversation.controller';
import { ChatConversationService } from './chat-conversation.service';

@Module({
  controllers: [ChatConversationController],
  providers: [ChatConversationService],
})
export class ChatConversationModule {}
