import { useEffect, useState } from 'react';
import { BookOpenText } from '@phosphor-icons/react';
import { getPublicUrl } from '@/services/domain-routing';
import { cn } from '@/lib/utils';

/**
 * Stable fallback tints, picked from the title rather than at random so a
 * library keeps the same face every time it is rendered. Tokens only — a
 * derived hue would need an inline colour, which the design system forbids.
 */
const FALLBACK_TINTS = [
    'bg-primary-50 text-primary-400',
    'bg-info-50 text-info-500',
    'bg-success-50 text-success-500',
    'bg-warning-50 text-warning-500',
];

const tintFor = (seed: string): string => {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    return FALLBACK_TINTS[Math.abs(hash) % FALLBACK_TINTS.length] as string;
};

interface LibraryCoverProps {
    fileId?: string | null;
    /** Describes the cover for screen readers and when the image fails to load. */
    alt?: string | null;
    /** Falls back to a tinted panel keyed on this. */
    title: string;
    className?: string;
}

/**
 * A library's cover art.
 *
 * File ids are resolved to URLs one at a time here rather than up front, so a
 * cover that has been deleted or expired degrades to the fallback panel instead
 * of leaving a broken image in the middle of the catalogue.
 */
export const LibraryCover = ({ fileId, alt, title, className }: LibraryCoverProps) => {
    const [url, setUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setUrl(null);
        setFailed(false);
        if (!fileId) return undefined;
        getPublicUrl(fileId)
            .then((resolved) => !cancelled && setUrl(resolved))
            .catch(() => !cancelled && setFailed(true));
        return () => {
            cancelled = true;
        };
    }, [fileId]);

    if (fileId && url && !failed) {
        return (
            <img
                src={url}
                // A cover with no description is decorative by definition: an
                // empty alt hides it from screen readers rather than making
                // them read out a file name.
                alt={alt || ''}
                onError={() => setFailed(true)}
                className={cn('size-full object-cover', className)}
            />
        );
    }

    return (
        <div
            className={cn('flex size-full items-center justify-center', tintFor(title), className)}
            aria-hidden="true"
        >
            <BookOpenText size={28} weight="duotone" />
        </div>
    );
};
