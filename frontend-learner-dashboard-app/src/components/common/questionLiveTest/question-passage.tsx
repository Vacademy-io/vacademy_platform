import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QuestionHtmlContent } from "./question-html-content";

const COLLAPSED_MAX_HEIGHT_PX = 180;

interface QuestionPassageProps {
  /** `parent_rich_text.content` of the current question — the comprehension passage. */
  html?: string | null;
  className?: string;
}

/**
 * Comprehension passage shown above the question.
 *
 * Sibling sub-questions each carry their own copy of the same passage
 * (the backend stores `parent_rich_text` per question), so this collapses
 * on a height cap rather than a character count — truncating raw HTML by
 * length would cut tags in half and can drop an embedded <img> entirely.
 */
export function QuestionPassage({ html, className }: QuestionPassageProps) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Collapse again when moving to a question with a different passage.
  useEffect(() => {
    setExpanded(false);
  }, [html]);

  // Only offer "Read more" when the passage actually exceeds the cap.
  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    const measure = () =>
      setIsOverflowing(node.scrollHeight > COLLAPSED_MAX_HEIGHT_PX + 8);

    measure();

    // Images (diagrams) load after paint and change the height, so re-measure.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [html]);

  if (!html || !html.trim()) return null;

  return (
    <div
      className={cn(
        "mb-4 rounded-xl border border-primary-100 bg-primary-50 p-4",
        className,
      )}
    >
      <p className="mb-2 text-caption font-bold uppercase tracking-wide text-primary-500">
        Passage
      </p>

      <div
        ref={contentRef}
        className={cn(
          "overflow-hidden transition-all",
          !expanded && "max-h-reg-180",
        )}
      >
        {/* text-gray-800 matches the question body below; tertiary-500 is a 74%
            lightness support tone and was unreadable on the tinted surface. */}
        <QuestionHtmlContent
          html={html}
          className="text-body text-gray-800 [&_img]:mx-auto [&_img]:h-auto [&_img]:max-w-full"
        />
      </div>

      {isOverflowing && (
        <Button
          variant="link"
          className="mt-1 h-auto p-0 text-primary-500"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Read less" : "Read more"}
          {expanded ? (
            <CaretUp className="ml-1 size-4" />
          ) : (
            <CaretDown className="ml-1 size-4" />
          )}
        </Button>
      )}
    </div>
  );
}
