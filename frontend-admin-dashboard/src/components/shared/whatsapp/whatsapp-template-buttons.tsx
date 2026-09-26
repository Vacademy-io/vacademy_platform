import { ArrowBendUpLeft, ArrowSquareOut, Phone } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/** One button of a WhatsApp template message, as notification-service returns it. */
export interface WhatsAppTemplateButton {
    /** URL | QUICK_REPLY | PHONE_NUMBER | COPY_CODE ... */
    type?: string;
    text: string;
    /** Complete http(s) link of a URL button; absent when it could not be rebuilt. */
    url?: string;
    phoneNumber?: string;
}

/**
 * A template's buttons, drawn under the message the way WhatsApp shows them. A URL button opens
 * its link and a phone button dials; a quick reply is only a label here — the admin is not the
 * one who would tap it.
 */
export function WhatsAppTemplateButtons({
    buttons,
    className,
}: {
    buttons: WhatsAppTemplateButton[];
    className?: string;
}) {
    return (
        <div className={cn('overflow-hidden', className)}>
            {buttons.map((button, i) => {
                const type = (button.type || '').toUpperCase();
                const rowClass =
                    'flex items-center justify-center gap-1.5 border-t border-black/10 px-3 py-2 text-sm font-medium text-blue-600 first:border-t-0';
                const href =
                    button.url && /^https?:\/\//i.test(button.url)
                        ? button.url
                        : type === 'PHONE_NUMBER' && button.phoneNumber
                          ? `tel:${button.phoneNumber.replace(/[^\d+]/g, '')}`
                          : undefined;
                const icon =
                    type === 'PHONE_NUMBER' ? (
                        <Phone size={14} />
                    ) : type === 'URL' ? (
                        <ArrowSquareOut size={14} />
                    ) : (
                        <ArrowBendUpLeft size={14} />
                    );

                return href ? (
                    <a
                        key={i}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={cn(rowClass, 'hover:bg-black/5')}
                    >
                        {icon}
                        <span className="truncate">{button.text}</span>
                    </a>
                ) : (
                    <div key={i} className={rowClass}>
                        {icon}
                        <span className="truncate">{button.text}</span>
                    </div>
                );
            })}
        </div>
    );
}
