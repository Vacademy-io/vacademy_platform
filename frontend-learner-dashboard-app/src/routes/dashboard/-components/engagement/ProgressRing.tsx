/**
 * Completion ring for the tasks card.
 *
 * SVG rather than a bar so progress reads at a glance next to the heading, and the
 * stroke animates on change via a CSS transition on the dash offset.
 */
export function ProgressRing({
  percent,
  done,
  total,
}: {
  percent: number;
  done: number;
  total: number;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const complete = total > 0 && done >= total;

  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-neutral-200 dark:stroke-neutral-800"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={
            complete
              ? "stroke-emerald-500 transition-all duration-700 ease-out"
              : "stroke-primary-500 transition-all duration-700 ease-out"
          }
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-100">
        {complete ? "🎉" : `${done}/${total}`}
      </span>
    </div>
  );
}
