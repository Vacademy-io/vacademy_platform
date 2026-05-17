import { useEffect } from 'react';

const VIMOTION_FAVICON = '/vimotion-favicon.svg';
const VIMOTION_TITLE = 'Vimotion';

export function useVimotionDocumentChrome() {
    useEffect(() => {
        const link = document.getElementById('app-favicon') as HTMLLinkElement | null;
        const previousHref = link?.getAttribute('href') ?? null;
        const previousType = link?.getAttribute('type') ?? null;
        const previousTitle = document.title;

        if (link) {
            link.setAttribute('href', VIMOTION_FAVICON);
            link.setAttribute('type', 'image/svg+xml');
        }
        document.title = VIMOTION_TITLE;

        return () => {
            if (link) {
                if (previousHref) link.setAttribute('href', previousHref);
                if (previousType) link.setAttribute('type', previousType);
            }
            document.title = previousTitle;
        };
    }, []);
}
