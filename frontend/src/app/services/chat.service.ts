import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ChatRequest, RichChatResponse, StreamChunk } from '../models/chat.model';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly chatEndpoint = `${environment.apiUrl}chat/`;

  sendMessage(question: string, history: string[], region?: string): Observable<RichChatResponse> {
    const body: ChatRequest = {
      user_question: question,
      conversation_history: { messages: history },
      region,
    };
    return this.http.post<RichChatResponse>(this.chatEndpoint, body);
  }

  streamMessage(question: string, history: string[], region?: string): Observable<StreamChunk> {
    return new Observable<StreamChunk>((subscriber) => {
      const controller = new AbortController();
      const body: ChatRequest = {
        user_question: question,
        conversation_history: { messages: history },
        region,
      };

      const token = this.authService.getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      fetch(`${this.chatEndpoint}stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            subscriber.error(new Error(`HTTP ${response.status}`));
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            subscriber.error(new Error('No response body'));
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;

              try {
                const chunk: StreamChunk = JSON.parse(trimmed.slice(6));
                subscriber.next(chunk);
                if (chunk.done) {
                  subscriber.complete();
                  return;
                }
              } catch {
                // Skip malformed lines
              }
            }
          }

          subscriber.complete();
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            subscriber.error(err);
          }
        });

      return () => controller.abort();
    });
  }
}
