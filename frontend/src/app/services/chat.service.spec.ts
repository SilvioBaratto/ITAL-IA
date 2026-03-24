import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { ChatService } from './chat.service';
import { AuthService } from './auth.service';
import { StreamChunk } from '../models/chat.model';
import { environment } from '../../environments/environment';

const STREAM_URL = `${environment.apiUrl}chat/stream`;

function sseLines(...chunks: StreamChunk[]): string[] {
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n`);
}

function makeStreamResponse(lines: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const encoded = lines.map((l) => encoder.encode(l));
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < encoded.length) {
        controller.enqueue(encoded[index++]);
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream, { status });
}

describe('ChatService', () => {
  let service: ChatService;
  let fetchSpy: jasmine.Spy;
  let authSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  function setup(token: string | null = 'test-token'): void {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'getAccessToken',
      'refreshSession',
      'logout',
    ]);
    authSpy.getAccessToken.and.returnValue(token);
    authSpy.refreshSession.and.returnValue(Promise.resolve(null));
    authSpy.logout.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
      ],
    });

    service = TestBed.inject(ChatService);
    router = TestBed.inject(Router);
    fetchSpy = spyOn(window, 'fetch');
  }

  it('emits each chunk and completes on done=true', (done) => {
    setup();
    const chunks: StreamChunk[] = [
      { type: 'partial', data: { text: 'Hello' }, done: false },
      { type: 'complete', data: { text: 'Hello world' }, done: true },
    ];
    fetchSpy.and.returnValue(Promise.resolve(makeStreamResponse(sseLines(...chunks))));

    const received: StreamChunk[] = [];
    service.streamMessage('question', []).subscribe({
      next: (c) => received.push(c),
      complete: () => {
        expect(received.length).toBe(2);
        expect(received[0].data.text).toBe('Hello');
        expect(received[1].data.text).toBe('Hello world');
        done();
      },
      error: done.fail,
    });
  });

  it('sends Authorization header when a token is available', (done) => {
    setup('my-token');
    fetchSpy.and.returnValue(
      Promise.resolve(makeStreamResponse(sseLines({ type: 'complete', data: {}, done: true }))),
    );

    service.streamMessage('q', []).subscribe({
      complete: () => {
        const headers = fetchSpy.calls.mostRecent().args[1].headers as Record<string, string>;
        expect(headers['Authorization']).toBe('Bearer my-token');
        done();
      },
      error: done.fail,
    });
  });

  it('omits Authorization header when no token is available', (done) => {
    setup(null);
    fetchSpy.and.returnValue(
      Promise.resolve(makeStreamResponse(sseLines({ type: 'complete', data: {}, done: true }))),
    );

    service.streamMessage('q', []).subscribe({
      complete: () => {
        const headers = fetchSpy.calls.mostRecent().args[1].headers as Record<string, string>;
        expect(headers['Authorization']).toBeUndefined();
        done();
      },
      error: done.fail,
    });
  });

  it('sends Content-Type: application/json', (done) => {
    setup();
    fetchSpy.and.returnValue(
      Promise.resolve(makeStreamResponse(sseLines({ type: 'complete', data: {}, done: true }))),
    );

    service.streamMessage('q', []).subscribe({
      complete: () => {
        const headers = fetchSpy.calls.mostRecent().args[1].headers as Record<string, string>;
        expect(headers['Content-Type']).toBe('application/json');
        done();
      },
      error: done.fail,
    });
  });

  it('includes the region field in the request body when provided', (done) => {
    setup();
    fetchSpy.and.returnValue(
      Promise.resolve(makeStreamResponse(sseLines({ type: 'complete', data: {}, done: true }))),
    );

    service.streamMessage('q', [], 'toscana').subscribe({
      complete: () => {
        const body = JSON.parse(fetchSpy.calls.mostRecent().args[1].body as string);
        expect(body.region).toBe('toscana');
        done();
      },
      error: done.fail,
    });
  });

  it('sends the question as user_question', (done) => {
    setup();
    fetchSpy.and.returnValue(
      Promise.resolve(makeStreamResponse(sseLines({ type: 'complete', data: {}, done: true }))),
    );

    service.streamMessage('What to visit?', ['prev']).subscribe({
      complete: () => {
        const body = JSON.parse(fetchSpy.calls.mostRecent().args[1].body as string);
        expect(body.user_question).toBe('What to visit?');
        expect(body.conversation_history.messages).toEqual(['prev']);
        done();
      },
      error: done.fail,
    });
  });

  it('posts to the correct stream endpoint', (done) => {
    setup();
    fetchSpy.and.returnValue(
      Promise.resolve(makeStreamResponse(sseLines({ type: 'complete', data: {}, done: true }))),
    );

    service.streamMessage('q', []).subscribe({
      complete: () => {
        expect(fetchSpy.calls.mostRecent().args[0]).toBe(STREAM_URL);
        done();
      },
      error: done.fail,
    });
  });

  it('errors with HTTP status message on a non-2xx response', (done) => {
    setup();
    fetchSpy.and.returnValue(Promise.resolve(new Response(null, { status: 403 })));

    service.streamMessage('q', []).subscribe({
      error: (err: Error) => {
        expect(err.message).toBe('HTTP 403');
        done();
      },
    });
  });

  it('errors when response body is null', (done) => {
    setup();
    fetchSpy.and.returnValue(Promise.resolve(new Response(null, { status: 200 })));

    service.streamMessage('q', []).subscribe({
      error: (err: Error) => {
        expect(err.message).toBe('No response body');
        done();
      },
    });
  });

  it('errors when a chunk has type="error"', (done) => {
    setup();
    const errorChunk: StreamChunk = { type: 'error', data: { text: 'Internal error' }, done: false };
    fetchSpy.and.returnValue(Promise.resolve(makeStreamResponse(sseLines(errorChunk))));

    service.streamMessage('q', []).subscribe({
      error: (err: Error) => {
        expect(err.message).toBe('Internal error');
        done();
      },
    });
  });

  it('skips malformed SSE lines and continues to valid chunks', (done) => {
    setup();
    const lines = [
      'data: {broken-json\n',
      `data: ${JSON.stringify({ type: 'complete', data: { text: 'ok' }, done: true })}\n`,
    ];
    fetchSpy.and.returnValue(Promise.resolve(makeStreamResponse(lines)));

    const received: StreamChunk[] = [];
    service.streamMessage('q', []).subscribe({
      next: (c) => received.push(c),
      complete: () => {
        expect(received.length).toBe(1);
        expect(received[0].data.text).toBe('ok');
        done();
      },
      error: done.fail,
    });
  });

  it('does not error after unsubscription (AbortError is suppressed)', (done) => {
    setup();
    const neverEnding = new ReadableStream({ start() {} });
    fetchSpy.and.returnValue(Promise.resolve(new Response(neverEnding, { status: 200 })));

    let errored = false;
    const sub = service.streamMessage('q', []).subscribe({
      error: () => { errored = true; },
    });

    setTimeout(() => {
      sub.unsubscribe();
      setTimeout(() => {
        expect(errored).toBe(false);
        done();
      }, 50);
    }, 10);
  });

  describe('401 token refresh retry', () => {
    it('retries with new token after 401 and completes successfully', (done) => {
      setup('expired-token');
      const newToken = 'fresh-token';
      authSpy.refreshSession.and.returnValue(Promise.resolve(newToken));

      const successChunk: StreamChunk = { type: 'complete', data: { text: 'ok' }, done: true };
      fetchSpy.and.returnValues(
        Promise.resolve(new Response(null, { status: 401 })),
        Promise.resolve(makeStreamResponse(sseLines(successChunk))),
      );

      service.streamMessage('q', []).subscribe({
        complete: () => {
          expect(fetchSpy).toHaveBeenCalledTimes(2);
          const retryHeaders = fetchSpy.calls.argsFor(1)[1].headers as Record<string, string>;
          expect(retryHeaders['Authorization']).toBe(`Bearer ${newToken}`);
          done();
        },
        error: done.fail,
      });
    });

    it('logs out and redirects to /login when refresh returns null', (done) => {
      setup('expired-token');
      authSpy.refreshSession.and.returnValue(Promise.resolve(null));
      fetchSpy.and.returnValue(Promise.resolve(new Response(null, { status: 401 })));

      const navigateSpy = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

      service.streamMessage('q', []).subscribe({
        error: (err: Error) => {
          expect(authSpy.logout).toHaveBeenCalled();
          expect(navigateSpy).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
          expect(err.message).toBe('Session expired. Please log in again.');
          done();
        },
      });
    });

    it('does not retry on non-401 errors', (done) => {
      setup();
      fetchSpy.and.returnValue(Promise.resolve(new Response(null, { status: 403 })));

      service.streamMessage('q', []).subscribe({
        error: (err: Error) => {
          expect(fetchSpy).toHaveBeenCalledTimes(1);
          expect(authSpy.refreshSession).not.toHaveBeenCalled();
          expect(err.message).toBe('HTTP 403');
          done();
        },
      });
    });
  });
});
