import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BrowserModule, SafeHtml } from '@angular/platform-browser';
import { MarkdownPipe } from './markdown.pipe';

function htmlOf(result: SafeHtml): string {
  return (result as unknown as { changingThisBreaksApplicationSecurity: string })
    .changingThisBreaksApplicationSecurity;
}

describe('MarkdownPipe', () => {
  let pipe: MarkdownPipe;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrowserModule],
      providers: [provideZonelessChangeDetection(), MarkdownPipe],
    }).compileComponents();
    pipe = TestBed.inject(MarkdownPipe);
  });

  it('returns empty string for null', () => {
    expect(pipe.transform(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(pipe.transform(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(pipe.transform('')).toBe('');
  });

  it('renders bold markdown', () => {
    expect(htmlOf(pipe.transform('**bold**') as SafeHtml)).toContain('<strong>bold</strong>');
  });

  it('renders italic markdown', () => {
    expect(htmlOf(pipe.transform('*italic*') as SafeHtml)).toContain('<em>italic</em>');
  });

  it('replaces [N] with citation using msgId', () => {
    expect(htmlOf(pipe.transform('See [1]', 'msg-123') as SafeHtml)).toContain(
      'data-citation="msg-123-1"',
    );
  });

  it('uses empty prefix for citation when no msgId is provided', () => {
    expect(htmlOf(pipe.transform('See [1]') as SafeHtml)).toContain('data-citation="-1"');
  });

  it('replaces multiple citations in one message', () => {
    const html = htmlOf(pipe.transform('[1] and [2]', 'msg') as SafeHtml);
    expect(html).toContain('data-citation="msg-1"');
    expect(html).toContain('data-citation="msg-2"');
  });

  it('handles double-digit citation numbers', () => {
    expect(htmlOf(pipe.transform('[12]', 'x') as SafeHtml)).toContain('data-citation="x-12"');
  });

  it('wraps citation in sup.citation-ref', () => {
    expect(htmlOf(pipe.transform('[1]', 'msg') as SafeHtml)).toContain(
      '<sup class="citation-ref">',
    );
  });

  it('adds citation-link class and aria-label to the anchor', () => {
    const html = htmlOf(pipe.transform('[1]', 'msg') as SafeHtml);
    expect(html).toContain('class="citation-link"');
    expect(html).toContain('aria-label="Fonte 1"');
  });

  it('does not replace citations inside inline code', () => {
    const html = htmlOf(pipe.transform('`[1]`') as SafeHtml);
    expect(html).toContain('[1]');
    expect(html).not.toContain('data-citation');
  });

  it('returns a SafeHtml value (bypassSecurityTrustHtml was called)', () => {
    const result = pipe.transform('hello') as SafeHtml;
    expect(
      (result as unknown as Record<string, unknown>)['changingThisBreaksApplicationSecurity'],
    ).toBeDefined();
  });
});
