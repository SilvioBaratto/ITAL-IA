import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ChatRequest, StreamChunk } from '../models/chat.model';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly chatEndpoint = `${environment.apiUrl}chat/`;

  streamMessage(question: string, history: string[], region?: string): Observable<StreamChunk> {
    return new Observable<StreamChunk>((subscriber) => {
      const controller = new AbortController();
      const body: ChatRequest = {
        user_question: question,
        conversation_history: { messages: history },
        region,
      };

      const doFetch = (token: string | null) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return fetch(`${this.chatEndpoint}stream`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      };

      const readStream = async (response: Response) => {
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
              if (chunk.type === 'error') {
                subscriber.error(new Error(chunk.data?.text || 'Stream error'));
                return;
              }
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
      };

      const run = async () => {
        let token = this.authService.getAccessToken();
        let response = await doFetch(token);

        // Mirror authInterceptor: on 401, refresh once then retry
        if (response.status === 401) {
          token = await this.authService.refreshSession();
          if (!token) {
            await this.authService.logout();
            this.router.navigate(['/login'], { replaceUrl: true });
            subscriber.error(new Error('Session expired. Please log in again.'));
            return;
          }
          response = await doFetch(token);
        }

        if (!response.ok) {
          subscriber.error(new Error(`HTTP ${response.status}`));
          return;
        }

        await readStream(response);
      };

      run().catch((err) => {
        if (err.name !== 'AbortError') {
          subscriber.error(err);
        }
      });

      return () => controller.abort();
    });
  }
}
