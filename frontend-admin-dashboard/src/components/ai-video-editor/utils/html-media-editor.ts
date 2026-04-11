/**
 * Utilities for extracting and replacing media elements (<img>, <video>)
 * inside entry HTML fragments.
 */

export interface MediaElement {
    index: number;
    tagName: 'IMG' | 'VIDEO';
    src: string;
    alt: string;
    /** Inline style width (e.g. "300px") */
    width: string;
    /** Inline style height (e.g. "200px") */
    height: string;
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME']);

function walkMedia(root: Element, results: MediaElement[], counter: { n: number }) {
    if (SKIP_TAGS.has(root.tagName)) return;

    if (root.tagName === 'IMG' || root.tagName === 'VIDEO') {
        const el = root as HTMLElement;
        const src = root.getAttribute('src') ?? '';
        if (src) {
            results.push({
                index: counter.n++,
                tagName: root.tagName as 'IMG' | 'VIDEO',
                src,
                alt: root.getAttribute('alt') ?? '',
                width: el.style.width || root.getAttribute('width') || '',
                height: el.style.height || root.getAttribute('height') || '',
            });
        }
        return;
    }

    for (const child of root.children) {
        walkMedia(child, results, counter);
    }
}

/**
 * Extract all <img> and <video> elements from an HTML fragment.
 */
export function extractMediaElements(html: string): MediaElement[] {
    if (typeof window === 'undefined' || !html) return [];
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(
            `<!DOCTYPE html><html><body>${html}</body></html>`,
            'text/html'
        );
        const results: MediaElement[] = [];
        walkMedia(doc.body, results, { n: 0 });
        return results;
    } catch {
        return [];
    }
}

/**
 * Replace the src of the media element at `index` with `newSrc`.
 * Returns updated HTML fragment.
 */
export function replaceMediaSrc(html: string, index: number, newSrc: string): string {
    if (typeof window === 'undefined' || !html) return html;
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(
            `<!DOCTYPE html><html><body>${html}</body></html>`,
            'text/html'
        );
        const counter = { n: 0 };
        let found = false;

        const find = (root: Element): void => {
            if (found) return;
            if (SKIP_TAGS.has(root.tagName)) return;
            if (root.tagName === 'IMG' || root.tagName === 'VIDEO') {
                if (root.getAttribute('src') && counter.n === index) {
                    root.setAttribute('src', newSrc);
                    found = true;
                    return;
                }
                if (root.getAttribute('src')) counter.n++;
                return;
            }
            for (const child of root.children) find(child);
        };

        find(doc.body);
        return doc.body.innerHTML;
    } catch {
        return html;
    }
}

/**
 * Remove the media element at `index` from the HTML fragment entirely.
 */
export function deleteMediaElement(html: string, index: number): string {
    if (typeof window === 'undefined' || !html) return html;
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(
            `<!DOCTYPE html><html><body>${html}</body></html>`,
            'text/html'
        );
        const counter = { n: 0 };
        let found = false;

        const find = (root: Element): void => {
            if (found) return;
            if (SKIP_TAGS.has(root.tagName)) return;
            if (root.tagName === 'IMG' || root.tagName === 'VIDEO') {
                if (root.getAttribute('src')) {
                    if (counter.n === index) {
                        root.parentElement?.removeChild(root);
                        found = true;
                        return;
                    }
                    counter.n++;
                }
                return;
            }
            for (const child of [...root.children]) find(child);
        };

        find(doc.body);
        return doc.body.innerHTML;
    } catch {
        return html;
    }
}

/**
 * Build the HTML fragment for a new media overlay entry.
 * The media fills the canvas with configurable object-fit.
 */
export function buildMediaOverlayHtml(
    src: string,
    mediaType: 'image' | 'video',
    objectFit: 'contain' | 'cover' | 'fill' = 'contain'
): string {
    const style = [
        'position:absolute',
        'inset:0',
        'width:100%',
        'height:100%',
        `object-fit:${objectFit}`,
    ].join(';');

    if (mediaType === 'video') {
        return `<video src="${src}" style="${style}" autoplay loop muted playsinline></video>`;
    }
    return `<img src="${src}" style="${style}" alt="media overlay" />`;
}
