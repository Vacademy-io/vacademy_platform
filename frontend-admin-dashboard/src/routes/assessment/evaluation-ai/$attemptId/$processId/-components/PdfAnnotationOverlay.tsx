import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnnotationBox } from './AnnotationBox';
import { MarginNote } from './MarginNote';
import { usePdfScale, type PageScaleMap } from './usePdfScale';

interface LayoutLine {
    line_id: string;
    text: string;
    box: [number, number, number, number];
    conf: number;
}

interface LayoutRegion {
    region_id: string;
    type: string;
    box: [number, number, number, number];
}

interface LayoutPage {
    page_id: string;
    page_index: number;
    width: number;
    height: number;
    lines: LayoutLine[];
    regions: LayoutRegion[];
}

export interface LayoutMap {
    pages: LayoutPage[];
}

export type AnnotationStyle =
    | 'tick'
    | 'cross'
    | 'circle'
    | 'underline'
    | 'margin_note'
    | 'region_note';

export interface Annotation {
    target: string;
    page_id: string;
    style: AnnotationStyle;
    text?: string;
    question_id?: string;
}

interface Props {
    pdfContainerEl: HTMLElement | null;
    layoutMap: LayoutMap | null;
    annotations: Annotation[];
    onAnnotationClick?: (annotation: Annotation) => void;
}

interface ResolvedAnnotation extends Annotation {
    box: [number, number, number, number];
}

/**
 * Per-page resolution: maps each LLM `target` (line_id or region_id) to the
 * concrete pixel box from the layout_map. Targets that don't resolve are
 * dropped silently — Java's CopyCheckCallbackService already filters those
 * server-side, this is a belt-and-braces guard.
 */
function indexLayout(layoutMap: LayoutMap | null): Map<string, [number, number, number, number]> {
    const idx = new Map<string, [number, number, number, number]>();
    if (!layoutMap) return idx;
    for (const page of layoutMap.pages) {
        for (const line of page.lines) idx.set(line.line_id, line.box);
        for (const region of page.regions) idx.set(region.region_id, region.box);
    }
    return idx;
}

/**
 * Render an annotation overlay layer over each rendered pdf.js page. Boxes,
 * circles, ticks, and crosses are anchored to the OCR line they reference;
 * margin notes are positioned in the right margin at the same y as their
 * target line.
 */
export function PdfAnnotationOverlay({
    pdfContainerEl,
    layoutMap,
    annotations,
    onAnnotationClick,
}: Props) {
    const scales: PageScaleMap = usePdfScale(pdfContainerEl, layoutMap);
    const targetIndex = useMemo(() => indexLayout(layoutMap), [layoutMap]);

    const byPage = useMemo(() => {
        const grouped: Record<string, ResolvedAnnotation[]> = {};
        for (const ann of annotations) {
            const box = targetIndex.get(ann.target);
            if (!box) continue;
            (grouped[ann.page_id] ??= []).push({ ...ann, box });
        }
        return grouped;
    }, [annotations, targetIndex]);

    if (!layoutMap) return null;

    return (
        <>
            {Object.entries(byPage).map(([pageId, items]) => {
                const dims = scales[pageId];
                if (!dims) return null;
                return createPortal(
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ zIndex: 5 }}
                        data-overlay-page={pageId}
                    >
                        {items.map((ann, i) => {
                            const key = `${pageId}:${ann.target}:${ann.style}:${i}`;
                            if (ann.style === 'margin_note') {
                                return (
                                    <MarginNote
                                        key={key}
                                        box={ann.box}
                                        text={ann.text ?? ''}
                                        dims={dims}
                                        onClick={() => onAnnotationClick?.(ann)}
                                    />
                                );
                            }
                            return (
                                <AnnotationBox
                                    key={key}
                                    style={ann.style}
                                    target={{ box: ann.box }}
                                    dims={dims}
                                    onClick={() => onAnnotationClick?.(ann)}
                                />
                            );
                        })}
                    </div>,
                    dims.pageEl,
                    pageId,
                );
            })}
        </>
    );
}
