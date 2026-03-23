import { inject, Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Matches [N] where N is one or more digits, but NOT inside <a> tags or <code>/<pre> blocks.
// Since marked.parse() already converts [text](url) to <a href="...">, remaining [N] are citations.
const CITATION_PATTERN = /\[(\d+)\](?!<\/a>)/g;

function inlineCitationLinks(html: string, msgId: string): string {
  // Skip replacement inside <code> and <pre> blocks
  const parts = html.split(/(<code[\s\S]*?<\/code>|<pre[\s\S]*?<\/pre>)/gi);
  return parts.map((part, i) => {
    // Odd indices are captured <code>/<pre> blocks — leave them untouched
    if (i % 2 === 1) return part;
    return part.replace(CITATION_PATTERN, (_, n: string) =>
      `<sup class="citation-ref"><a data-citation="${msgId}-${n}" class="citation-link" role="link" tabindex="0" aria-label="Fonte ${n}">[${n}]</a></sup>`
    );
  }).join('');
}

@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined, msgId?: string): SafeHtml {
    if (!value) return '';
    const html = marked.parse(value, { async: false }) as string;
    const withCitations = inlineCitationLinks(html, msgId ?? '');
    return this.sanitizer.bypassSecurityTrustHtml(withCitations);
  }
}
