import { ArrowLeft, CaretDoubleLeft, CaretDoubleRight, CheckCircle, Circle, RadioButton } from "@phosphor-icons/react";

export interface TutorTopicItem {
  id: string;
  title: string;
  concepts: number;
}

interface TutorSidebarProps {
  slideTitle: string;
  topics: TutorTopicItem[];
  activeTopicId: string | null;
  progressPercent: number;
  done: number;
  total: number;
  nextSlides: Array<{ slide_id: string; title: string | null; teachable: boolean; current: boolean }>;
  onPickSlide: (slideId: string) => void;
  /** Leave the lesson (immersive layout has no app chrome to go back through). */
  onBack?: () => void;
  /** Desktop rail: fold to a thin strip of board dots so the whiteboard gets the width. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

/** Left rail: the boards of this slide, overall progress, and the chapter's other slides. */
export const TutorSidebar: React.FC<TutorSidebarProps> = ({
  slideTitle, topics, activeTopicId, progressPercent, done, total, nextSlides, onPickSlide,
  onBack, collapsed, onToggleCollapse,
}) => {
  const activeIndex = Math.max(0, topics.findIndex((t) => t.id === activeTopicId));

  if (collapsed) {
    return (
      <aside className="flex h-full flex-col items-center gap-2 py-1" aria-label="Lesson outline (collapsed)">
        {onBack && (
          <button type="button" onClick={onBack} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100" title="Back to course">
            <ArrowLeft className="size-4" />
          </button>
        )}
        {onToggleCollapse && (
          <button type="button" onClick={onToggleCollapse} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100" title="Show the outline">
            <CaretDoubleRight className="size-4" />
          </button>
        )}
        <span className="mt-1 text-xs font-semibold tabular-nums text-neutral-700" title={`${done} of ${total} concepts`}>{progressPercent}%</span>
        <ol className="mt-1 flex flex-col items-center gap-1.5">
          {topics.map((t, i) => {
            const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
            return (
              <li key={t.id} title={t.title}>
                {state === "done" ? (
                  <CheckCircle className="size-4 text-neutral-400" weight="fill" />
                ) : state === "active" ? (
                  <RadioButton className="size-4 text-primary-500" weight="fill" />
                ) : (
                  <Circle className="size-4 text-neutral-300" />
                )}
              </li>
            );
          })}
        </ol>
      </aside>
    );
  }

  return (
    <aside className="flex h-full flex-col gap-3 overflow-y-auto">
      <div className="flex items-center justify-between gap-1">
        {onBack ? (
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800">
            <ArrowLeft className="size-3.5" /> Course
          </button>
        ) : <span />}
        {onToggleCollapse && (
          <button type="button" onClick={onToggleCollapse} className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" title="Hide the outline">
            <CaretDoubleLeft className="size-3.5" />
          </button>
        )}
      </div>
      <div>
        <h2 className="text-sm font-semibold leading-snug text-neutral-900">{slideTitle}</h2>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="text-xs tabular-nums text-neutral-500">{done}/{total}</span>
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Boards</p>
        <ol className="space-y-0.5">
          {topics.map((t, i) => {
            const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
            return (
              <li
                key={t.id}
                className={`flex items-start gap-1.5 rounded-md px-1.5 py-1 text-xs leading-snug ${
                  state === "active" ? "bg-primary-50 font-medium text-primary-500" : state === "done" ? "text-neutral-400" : "text-neutral-700"
                }`}
              >
                {state === "done" ? (
                  <CheckCircle className="mt-px size-3.5 shrink-0" />
                ) : state === "active" ? (
                  <RadioButton className="mt-px size-3.5 shrink-0" weight="fill" />
                ) : (
                  <Circle className="mt-px size-3.5 shrink-0" />
                )}
                <span className="line-clamp-2">{t.title}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {nextSlides.length > 1 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">This chapter</p>
          <ol className="space-y-0.5">
            {nextSlides.map((s) => (
              <li key={s.slide_id}>
                <button
                  type="button"
                  disabled={!s.teachable || s.current}
                  onClick={() => onPickSlide(s.slide_id)}
                  title={!s.teachable ? "Not in tutor mode" : undefined}
                  className={`w-full rounded-md px-1.5 py-1 text-start text-xs leading-snug disabled:cursor-default ${
                    s.current ? "bg-neutral-100 font-medium text-neutral-900" : s.teachable ? "text-neutral-600 hover:bg-neutral-50" : "text-neutral-400"
                  }`}
                >
                  <span className="line-clamp-2">{s.title || "Untitled"}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
};
