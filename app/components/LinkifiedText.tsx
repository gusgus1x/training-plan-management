import { Fragment } from "react";

// Only http(s) becomes a link, so a "javascript:" typed into a description stays plain text.
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
// Sentence punctuation right after a URL belongs to the sentence, not the address.
const TRAILING = /[.,;:!?)\]}'"]+$/;

export type TextPart = { text: string; href?: string };

/** Splits free text into plain runs and http(s) links. */
export const splitLinks = (text: string): TextPart[] => {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const href = match[0].replace(TRAILING, "");
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: href, href });
    last = start + href.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
};

/** Free text with its web addresses clickable, each opening in a new tab. */
export default function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, index) =>
        part.href ? (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--ui-30-primary, #2563eb)", textDecoration: "underline", wordBreak: "break-all" }}
          >
            {part.text}
          </a>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}
