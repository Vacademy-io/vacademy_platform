import { cn } from '@/lib/utils';
import type { PageDims } from './usePdfScale';

export interface MarginNoteProps {
    box: [number, number, number, number];
    text: string;
    dims: PageDims;
    onClick?: () => void;
}

const MARGIN_WIDTH = 180;
const MARGIN_OFFSET = 12;

/**
 * Render a red note in the right margin at the same y as the target line,
 * with a dashed SVG leader from the line to the note. Positions are in
 * scaled (rendered) px, so zoom/resize keep the note locked to its line.
 */
export function MarginNote({ box, text, dims, onClick }: MarginNoteProps) {
    const [bx, by, bw, bh] = box;
    const lineRight = (bx + bw) * dims.scale;
    const lineMidY = (by + bh / 2) * dims.scale;
    // On a narrow render (side panel at low zoom) a fixed 180px "margin" lands
    // in the middle of the handwriting — scale the note down with the page so
    // it hugs the right edge instead of blanking out the student's work.
    const noteWidth = Math.min(MARGIN_WIDTH, Math.max(110, dims.renderedWidth * 0.26));
    const noteLeft = dims.renderedWidth - noteWidth - MARGIN_OFFSET;
    const noteTop = Math.max(0, lineMidY - 12);

    return (
        <>
            <svg
                className="absolute pointer-events-none"
                style={{
                    left: lineRight,
                    top: lineMidY - 1,
                    width: noteLeft - lineRight,
                    height: 2,
                    overflow: 'visible',
                }}
            >
                <line
                    x1={0}
                    y1={1}
                    x2={noteLeft - lineRight}
                    y2={1}
                    className="stroke-danger-500"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                />
            </svg>
            <div
                onClick={onClick}
                className={cn(
                    'absolute pointer-events-auto cursor-pointer',
                    // Translucent, not opaque: when the note has to sit over
                    // writing, the writing must stay readable through it.
                    'bg-danger-50/80 text-danger-700 border border-danger-500 rounded-sm',
                    'px-1.5 py-0.5 text-caption italic leading-snug shadow-sm',
                )}
                style={{
                    left: noteLeft,
                    top: noteTop,
                    width: noteWidth,
                }}
            >
                {text}
            </div>
        </>
    );
}
