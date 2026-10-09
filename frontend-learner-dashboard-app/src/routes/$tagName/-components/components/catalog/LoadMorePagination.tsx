import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * "Load more courses" + "Showing 9 of 24" (feature 'cards'; Figma courses
 * node 1:401). Replaces the numbered pagination only for a section with
 * render.pagination.mode "loadMore". Texts arrive in the visitor's language.
 *
 * A click reveals the next batch in place (no scroll jump) and moves focus
 * to the first newly revealed card's CTA, so keyboard users continue there.
 * The button disappears once every card is shown; the count line stays.
 */

// Figma: 182 x 53 secondary button, 15/23 text, 8 px radius.
const BUTTON_CLASS =
  "inline-flex h-[53px] w-full max-w-xs items-center justify-center rounded-lg border bg-catalogue-bg-elevated px-7 text-[15px] font-normal leading-[23px] text-palette-text transition-colors hover:bg-palette-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 sm:w-auto"; // design-lint-ignore: Figma 53px button, 15/23 text

export interface LoadMorePaginationProps {
  shown: number;
  total: number;
  onLoadMore: () => void;
  /** Button text (visitor language). */
  label: string;
  /** "Showing 9 of 24" (visitor language). */
  countText: string;
  /** The grid the cards render in (focus target lookup + aria-controls). */
  gridRef?: React.RefObject<HTMLElement | null>;
  gridId?: string;
  /** Section-authored border colour (hex); default the palette muted2 ink at 80%. */
  borderColor?: string;
}

export const LoadMorePagination: React.FC<LoadMorePaginationProps> = ({
  shown,
  total,
  onLoadMore,
  label,
  countText,
  gridRef,
  gridId,
  borderColor,
}) => {
  const focusFrom = useRef<number | null>(null);

  useEffect(() => {
    const from = focusFrom.current;
    if (from === null || shown <= from) return;
    focusFrom.current = null;
    const cta = gridRef?.current?.querySelector<HTMLElement>(`[data-card-index="${from}"] [data-card-cta]`);
    cta?.focus({ preventScroll: true });
  }, [shown, gridRef]);

  if (total <= 0) return null;
  return (
    <div className="flex flex-col items-center gap-2" data-load-more="">
      {shown < total && (
        <button
          type="button"
          aria-controls={gridId}
          onClick={() => {
            focusFrom.current = shown;
            onLoadMore();
          }}
          className={cn(BUTTON_CLASS, !borderColor && "border-palette-muted2/80")}
          style={borderColor ? { borderColor } : undefined} // design-lint-ignore: section-authored border colour
        >
          {label}
        </button>
      )}
      <p className="text-xs leading-4 text-palette-muted" aria-live="polite">
        {countText}
      </p>
    </div>
  );
};

export default LoadMorePagination;
