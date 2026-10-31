import type { ReactNode } from "react";

/**
 * A deliberately small markdown subset for chat: code, emphasis, links and
 * mentions. Everything else falls through as plain text so a message can never
 * inject markup.
 */

const INLINE_PATTERN =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(~~[^~\n]+~~)|(https?:\/\/[^\s<>()]+)|(@[a-zA-Z0-9_]{2,32})/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let index = 0;
  INLINE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground/90"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("__")) {
      nodes.push(
        <u key={key}>{token.slice(2, -2)}</u>,
      );
    } else if (token.startsWith("~~")) {
      nodes.push(
        <s key={key} className="opacity-70">
          {token.slice(2, -2)}
        </s>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("http")) {
      nodes.push(
        <a
          key={key}
          href={token}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-cyan underline decoration-cyan/40 underline-offset-2 hover:decoration-cyan"
        >
          {token}
        </a>,
      );
    } else if (token.startsWith("@")) {
      nodes.push(
        <span
          key={key}
          className="cursor-pointer rounded bg-primary/15 px-1 font-medium text-primary hover:bg-primary/25"
          data-mention={token.slice(1).toLowerCase()}
        >
          {token}
        </span>,
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function renderMessage(content: string): ReactNode[] {
  const segments = content.split(/```/);
  return segments.map((segment, index) => {
    if (index % 2 === 1) {
      const body = segment.replace(/^[a-zA-Z0-9]+\n/, "");
      return (
        <pre
          key={`code-${index}`}
          className="my-1 overflow-x-auto rounded-lg border border-border/70 bg-surface p-3 font-mono text-[13px] leading-5 text-foreground/90"
        >
          <code>{body}</code>
        </pre>
      );
    }
    const lines = segment.split("\n");
    return (
      <span key={`text-${index}`}>
        {lines.map((line, lineIndex) => (
          <span key={lineIndex}>
            {renderInline(line, `text-${index}-${lineIndex}`)}
            {lineIndex < lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </span>
    );
  });
}

export function plainExcerpt(content: string, max = 140): string {
  const cleaned = content
    .replace(/```[\s\S]*?```/g, " [code] ")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}
