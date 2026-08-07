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
    | 'strike'
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

/** A question's circled mark, anchored beside its answer on the sheet —
 *  the way a checked copy carries "4.5" in the margin next to the work. */
export interface QuestionScoreMarker {
    /** line/region id whose y-position anchors the badge */
    target: string;
    page_id: string;
    /** already-formatted marks, e.g. "4.5" */
    label: string;
    /** e.g. "/ 10" — shown small under the marks */
    outOf?: string;
}

interface Props {
    pdfContainerEl: HTMLElement | null;
    layoutMap: LayoutMap | null;
    annotations: Annotation[];
    scores?: QuestionScoreMarker[];
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
    scores,
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

    const scoresByPage = useMemo(() => {
        const grouped: Record<
            string,
            Array<QuestionScoreMarker & { box: [number, number, number, number] }>
        > = {};
        for (const marker of scores ?? []) {
            const box = targetIndex.get(marker.target);
            if (!box) continue;
            (grouped[marker.page_id] ??= []).push({ ...marker, box });
        }
        return grouped;
    }, [scores, targetIndex]);

    if (!layoutMap) return null;

    const pageIds = Array.from(
        new Set([...Object.keys(byPage), ...Object.keys(scoresByPage)])
    );

    return (
        <>
            {pageIds.map((pageId) => {
                const items = byPage[pageId] ?? [];
                const dims = scales[pageId];
                if (!dims) return null;
                return createPortal(
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ zIndex: 5 }}
                        data-overlay-page={pageId}
                    >
                        {(scoresByPage[pageId] ?? []).map((marker, i) => {
                            const midY = (marker.box[1] + marker.box[3] / 2) * dims.scale;
                            return (
                                <div
                                    key={`score:${pageId}:${marker.target}:${i}`}
                                    className="absolute flex flex-col items-center justify-center rounded-full border-2 border-danger-500 bg-white/85 text-danger-600"
                                    style={{
                                        left: dims.renderedWidth - 48,
                                        top: Math.max(4, midY - 20),
                                        width: 40,
                                        height: 40,
                                    }}
                                >
                                    <span className="text-body font-semibold leading-none">
                                        {marker.label}
                                    </span>
                                    {marker.outOf && (
                                        <span className="text-[9px] leading-none opacity-80">
                                            {marker.outOf}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
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
                                    text={ann.text}
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
