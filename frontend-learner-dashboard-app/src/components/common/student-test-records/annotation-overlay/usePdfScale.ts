import { useEffect, useState } from 'react';

export interface PageDims {
    pdfWidth: number;
    pdfHeight: number;
    renderedWidth: number;
    renderedHeight: number;
    scale: number;
    pageEl: HTMLElement;
}

export type PageScaleMap = Record<string, PageDims>;

interface LayoutPage {
    page_id: string;
    page_index: number;
    width: number;
    height: number;
}

interface LayoutMap {
    pages: LayoutPage[];
}

/**
 * Watch the @react-pdf-viewer DOM for rendered page elements and emit a scale
 * factor per page. The viewer renders each page into a
 * <div data-testid="core__page-layer-<idx>"> whose clientWidth × clientHeight
 * reflects pdf.js's actual on-screen size at the current zoom. Dividing by the
 * OCR full_res dimensions gives the pixel multiplier AnnotationBox uses.
 *
 * Re-measures on resize and whenever pdf.js mutates the DOM (zoom, page change).
 */
export function usePdfScale(
    containerEl: HTMLElement | null,
    layoutMap: LayoutMap | null
): PageScaleMap {
    const [scales, setScales] = useState<PageScaleMap>({});

    useEffect(() => {
        if (!containerEl || !layoutMap) return;

        const pageByIndex: Record<number, LayoutPage> = {};
        for (const p of layoutMap.pages) pageByIndex[p.page_index] = p;

        let rafId: number | null = null;

        const measure = () => {
            const next: PageScaleMap = {};
            const pageEls = containerEl.querySelectorAll<HTMLElement>(
                '[data-testid^="core__page-layer-"]'
            );
            pageEls.forEach((el) => {
                const idxAttr = el
                    .getAttribute('data-testid')
                    ?.replace('core__page-layer-', '');
                const idx = idxAttr ? parseInt(idxAttr, 10) : NaN;
                if (Number.isNaN(idx)) return;
                const meta = pageByIndex[idx];
                if (!meta) return;
                const renderedWidth = el.clientWidth;
                const renderedHeight = el.clientHeight;
                if (!renderedWidth || !renderedHeight) return;
                next[meta.page_id] = {
                    pdfWidth: meta.width,
                    pdfHeight: meta.height,
                    renderedWidth,
                    renderedHeight,
                    scale: renderedWidth / meta.width,
                    pageEl: el,
                };
            });
            // Shallow-equal guard: don't bump the reference when the measured map
            // is identical, else the overlay re-renders → mutates portal targets →
            // fires the MutationObserver again → an infinite cheap-render loop.
            setScales((prev) => (mapsAreEqual(prev, next) ? prev : next));
        };

        const schedule = () => {
            if (rafId !== null) return;
            rafId = window.requestAnimationFrame(() => {
                rafId = null;
                measure();
            });
        };

        measure();
        const observer = new MutationObserver(schedule);
        observer.observe(containerEl, { childList: true, subtree: true });
        window.addEventListener('resize', schedule);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', schedule);
            if (rafId !== null) window.cancelAnimationFrame(rafId);
        };
    }, [containerEl, layoutMap]);

    return scales;
}

function mapsAreEqual(a: PageScaleMap, b: PageScaleMap): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
        const av = a[k];
        const bv = b[k];
        if (!av || !bv) return false;
        if (
            av.renderedWidth !== bv.renderedWidth ||
            av.renderedHeight !== bv.renderedHeight ||
            av.pageEl !== bv.pageEl
        ) {
            return false;
        }
    }
    return true;
}
