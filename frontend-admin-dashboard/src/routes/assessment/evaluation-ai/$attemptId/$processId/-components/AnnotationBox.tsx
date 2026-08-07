import { Check, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { PageDims } from './usePdfScale';

export interface AnnotationTarget {
    box: [number, number, number, number]; // [x, y, w, h] in full_res px
}

export interface AnnotationProps {
    style: 'tick' | 'cross' | 'circle' | 'strike' | 'underline' | 'region_note';
    target: AnnotationTarget;
    dims: PageDims;
    /** Pen note carried by the annotation — rendered for strike (the note IS
     *  the correction, drawn above the struck words, mirroring the burned-in
     *  PDF) and exposed as a tooltip on every other marked style. */
    text?: string;
    onClick?: () => void;
}

/**
 * Draw one annotation on top of a rendered pdf.js page. Position is computed
 * by scaling the OCR full_res box by dims.scale. All boxes are absolute-
 * positioned inside a wrapper that's itself absolutely positioned to fill
 * the parent page element (`pointerEvents: none` so the underlying text
 * selection still works; each <AnnotationBox> re-enables clicks for itself).
 */
export function AnnotationBox({ style, target, dims, text, onClick }: AnnotationProps) {
    const [bx, by, bw, bh] = target.box;
    const x = bx * dims.scale;
    const y = by * dims.scale;
    const w = bw * dims.scale;
    const h = bh * dims.scale;
    const padding = 4;

    if (style === 'tick' || style === 'cross') {
        return (
            <div
                onClick={onClick}
                title={text || undefined}
                className={cn(
                    'absolute flex items-center justify-center pointer-events-auto cursor-pointer',
                    style === 'tick' ? 'text-success-500' : 'text-danger-500',
                )}
                style={{
                    left: x + w + padding,
                    top: y,
                    width: h,
                    height: h,
                }}
            >
                {style === 'tick' ? (
                    <Check size={h * 0.8} weight="bold" />
                ) : (
                    <X size={h * 0.8} weight="bold" />
                )}
            </div>
        );
    }

    if (style === 'strike') {
        // Line through the middle of the span, with the correction floating
        // just above the struck words — mirroring the burned-in PDF, where the
        // note IS the correction ('Payment does not transfer ownership').
        return (
            <div onClick={onClick} className="pointer-events-auto cursor-pointer" title={text || undefined}>
                {text && (
                    <span
                        className="absolute italic text-danger-600 whitespace-nowrap"
                        style={{
                            left: x + Math.max(0, w / 2 - text.length * 3.2),
                            top: y - 14,
                            fontSize: 11,
                        }}
                    >
                        {text}
                    </span>
                )}
                <div
                    className="absolute border-t-2 border-danger-500"
                    style={{
                        left: x,
                        top: y + h / 2,
                        width: w,
                        height: 0,
                    }}
                />
            </div>
        );
    }

    if (style === 'circle') {
        // Amber ring around the span — partial/needs-attention, matching the
        // annotator's _ATTENTION colour so screen and PDF carry one verdict
        // language. (Without this branch it fell to the red catch-all box and
        // read as "wrong".)
        return (
            <div
                onClick={onClick}
                title={text || undefined}
                className="absolute pointer-events-auto cursor-pointer border-2 border-warning-500 rounded-full"
                style={{
                    left: x - padding,
                    top: y - padding,
                    width: w + padding * 2,
                    height: h + padding * 2,
                }}
            />
        );
    }

    if (style === 'underline') {
        return (
            <div
                onClick={onClick}
                className="absolute pointer-events-auto cursor-pointer border-b-2 border-danger-500"
                style={{
                    left: x,
                    top: y + h - 1,
                    width: w,
                    height: 0,
                }}
            />
        );
    }

    if (style === 'region_note') {
        return (
            <div
                onClick={onClick}
                className="absolute pointer-events-auto cursor-pointer border-2 border-warning-500 rounded-sm"
                style={{
                    left: x - padding,
                    top: y - padding,
                    width: w + padding * 2,
                    height: h + padding * 2,
                }}
            />
        );
    }

    return (
        <div
            onClick={onClick}
            className="absolute pointer-events-auto cursor-pointer border-2 border-danger-500 rounded-md"
            style={{
                left: x - padding,
                top: y - padding,
                width: w + padding * 2,
                height: h + padding * 2,
            }}
        />
    );
}
