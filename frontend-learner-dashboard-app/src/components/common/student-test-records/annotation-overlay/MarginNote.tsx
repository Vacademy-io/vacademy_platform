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
 * Render a note in the right margin at the same y as the target line, with a
 * dashed leader from the line to the note. Positions are in scaled (rendered)
 * px, so zoom/resize keep the note locked to its line.
 */
export function MarginNote({ box, text, dims, onClick }: MarginNoteProps) {
    const [bx, by, bw, bh] = box;
    const lineRight = (bx + bw) * dims.scale;
    const lineMidY = (by + bh / 2) * dims.scale;
    const noteLeft = dims.renderedWidth - MARGIN_WIDTH - MARGIN_OFFSET;
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
                    'bg-danger-50 text-danger-700 border border-danger-500 rounded-sm',
                    'px-2 py-1 text-caption shadow-sm'
                )}
                style={{
                    left: noteLeft,
                    top: noteTop,
                    width: MARGIN_WIDTH,
                }}
            >
                {text}
            </div>
        </>
    );
}
