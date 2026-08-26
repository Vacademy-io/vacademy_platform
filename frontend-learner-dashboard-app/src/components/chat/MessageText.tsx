import { cn } from "@/lib/utils";
import { openInBrowser } from "@/lib/open-in-browser";
import { linkifySegments } from "./linkify";

export interface MessageTextProps {
  text: string;
  /** True for the sender's own bubble, which sits on the primary fill. */
  isOwn?: boolean;
  className?: string;
}

/**
 * Renders message text with URLs, emails and phone numbers as real links.
 *
 * Web links are handed to `openInBrowser` so they leave the Capacitor/Electron shell for the
 * system browser instead of replacing the app's own WebView (which strands the learner with
 * no way back). `mailto:`/`tel:` keep the plain anchor behaviour so the OS handler takes over.
 */
export function MessageText({ text, isOwn = false, className }: MessageTextProps) {
  const segments = linkifySegments(text);

  return (
    <p className={cn("whitespace-pre-wrap break-words", className)}>
      {segments.map((segment, index) => {
        if (segment.kind === "text") {
          return <span key={index}>{segment.text}</span>;
        }

        const href = segment.href as string;
        const isWebLink = /^https?:/i.test(href);

        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={
              isWebLink
                ? (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void openInBrowser(href);
                  }
                : undefined
            }
            className={cn(
              // `break-all` only on links: a long invite URL would otherwise stretch
              // the bubble past the thread and force a horizontal scroll.
              "break-all font-medium underline underline-offset-2 hover:opacity-80",
              // On the sender's own primary-filled bubble a blue link would sink into
              // the fill, so it stays on the bubble's foreground colour and relies on
              // the underline; received bubbles get the info (link blue) token.
              isOwn ? "text-primary-foreground" : "text-info-600 dark:text-info-400",
            )}
          >
            {segment.text}
          </a>
        );
      })}
    </p>
  );
}
