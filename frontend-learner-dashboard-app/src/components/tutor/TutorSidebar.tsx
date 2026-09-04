import { CheckCircle, Circle, RadioButton } from "@phosphor-icons/react";

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
}

/** Left rail: the boards of this slide, overall progress, and the chapter's other slides. */
export const TutorSidebar: React.FC<TutorSidebarProps> = ({
  slideTitle, topics, activeTopicId, progressPercent, done, total, nextSlides, onPickSlide,
}) => {
  const activeIndex = Math.max(0, topics.findIndex((t) => t.id === activeTopicId));
  return (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">{slideTitle}</h2>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {done} of {total} concepts · {progressPercent}%
        </p>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Boards</p>
        <ol className="space-y-1">
          {topics.map((t, i) => {
            const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
            return (
              <li
                key={t.id}
                className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${
                  state === "active" ? "bg-primary-50 text-primary-500 font-medium" : state === "done" ? "text-neutral-500" : "text-neutral-700"
                }`}
              >
                {state === "done" ? (
                  <CheckCircle className="mt-0.5 size-4 shrink-0" />
                ) : state === "active" ? (
                  <RadioButton className="mt-0.5 size-4 shrink-0" weight="fill" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0" />
                )}
                <span className="line-clamp-2">{t.title}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {nextSlides.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">This chapter</p>
          <ol className="space-y-1">
            {nextSlides.map((s) => (
              <li key={s.slide_id}>
                <button
                  type="button"
                  disabled={!s.teachable || s.current}
                  onClick={() => onPickSlide(s.slide_id)}
                  className={`w-full rounded-lg px-2 py-1.5 text-left text-sm disabled:cursor-default ${
                    s.current ? "bg-neutral-100 font-medium text-neutral-900" : s.teachable ? "text-neutral-700 hover:bg-neutral-50" : "text-neutral-400"
                  }`}
                >
                  {s.title || "Untitled"}
                  {!s.teachable && <span className="ml-1 text-xs">(not in tutor mode)</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
};
