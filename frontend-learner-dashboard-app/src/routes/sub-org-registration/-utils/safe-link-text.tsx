import type { ReactNode } from "react";

const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

/**
 * Renders institute-authored text, converting [label](url) segments into
 * anchors. Built as React nodes (never raw HTML) so the text stays inert;
 * only http(s) URLs become links. Shared by the TNC consent statements, the
 * KYC instructions callout and the completion panel's custom message.
 */
export const renderSafeLinkText = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(LINK_PATTERN);
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <a
        key={`${match.index}-${match[2]}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary-500 underline underline-offset-2 hover:text-primary-400"
      >
        {match[1]}
      </a>
    );
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
};
