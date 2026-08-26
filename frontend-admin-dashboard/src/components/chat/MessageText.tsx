import { cn } from '@/lib/utils';
import { linkifySegments } from './linkify';

export interface MessageTextProps {
    text: string;
    /** True for the sender's own bubble, which sits on the primary fill. */
    isOwn?: boolean;
    className?: string;
}

/** Renders message text with URLs, emails and phone numbers as real, clickable links. */
export function MessageText({ text, isOwn = false, className }: MessageTextProps) {
    const segments = linkifySegments(text);

    return (
        <div className={cn('whitespace-pre-wrap break-words', className)}>
            {segments.map((segment, index) => {
                if (segment.kind === 'text') {
                    return <span key={index}>{segment.text}</span>;
                }

                return (
                    <a
                        key={index}
                        href={segment.href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        // The bubble itself has no click handler today, but keep the link's
                        // click to itself so a future row-level action can't steal it.
                        onClick={(event) => event.stopPropagation()}
                        className={cn(
                            // `break-all` only on links: a long invite URL would otherwise
                            // stretch the bubble past the thread and force a sideways scroll.
                            'break-all font-medium underline underline-offset-2',
                            // A blue link would sink into the primary fill of the sender's own
                            // bubble, so there it keeps the bubble's foreground colour and
                            // leans on the underline; received bubbles get the link-blue token.
                            isOwn
                                ? 'text-white hover:text-white/80'
                                : 'text-info-600 hover:text-info-700'
                        )}
                    >
                        {segment.text}
                    </a>
                );
            })}
        </div>
    );
}
