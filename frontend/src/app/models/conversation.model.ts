import { RichContent } from './chat.model';

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  richContent: RichContent | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  regionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

export interface ConversationDetail {
  id: string;
  regionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

export interface AppendMessageRequest {
  role: 'USER' | 'ASSISTANT';
  content: string;
  richContent?: Record<string, unknown> | null;
}
