import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ConversationSummary,
  ConversationDetail,
  ConversationMessage,
  AppendMessageRequest,
} from '../models/conversation.model';

@Injectable({
  providedIn: 'root',
})
export class ConversationService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}conversations`;

  create(regionId: string, title?: string): Observable<ConversationSummary> {
    return this.http.post<ConversationSummary>(this.endpoint, { regionId, title });
  }

  list(regionId?: string): Observable<ConversationSummary[]> {
    const params: Record<string, string> = {};
    if (regionId) params['regionId'] = regionId;
    return this.http.get<ConversationSummary[]>(this.endpoint, { params });
  }

  get(id: string): Observable<ConversationDetail> {
    return this.http.get<ConversationDetail>(`${this.endpoint}/${id}`);
  }

  appendMessage(conversationId: string, body: AppendMessageRequest): Observable<ConversationMessage> {
    return this.http.post<ConversationMessage>(
      `${this.endpoint}/${conversationId}/messages`,
      body,
    );
  }

  updateTitle(conversationId: string, title: string): Observable<ConversationSummary> {
    return this.http.patch<ConversationSummary>(
      `${this.endpoint}/${conversationId}/title`,
      { title },
    );
  }

  delete(conversationId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${conversationId}`);
  }
}
