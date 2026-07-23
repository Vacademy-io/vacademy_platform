import { useEffect, useState } from "react";
import { Eye, SignOut } from "@phosphor-icons/react";
import {
  isChildViewActive,
  getChildViewName,
  exitChildView,
} from "@/routes/parent/child/-lib/child-view";

/**
 * The persistent "you are viewing as your child" banner, shown app-wide while a
 * guardian is in child-view. Exiting restores the parent's own session. Rendered
 * from the app root; renders nothing when child-view is inactive.
 */
export function ChildViewBanner() {
  const [exiting, setExiting] = useState(false);
  const active = isChildViewActive();

  // The banner is fixed (h-10), so push the whole app down while it is shown —
  // otherwise it covers the learner top bar (which sticks below it, see navbar).
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.paddingTop;
    document.body.style.paddingTop = "2.5rem"; // = h-10, genuinely dynamic (banner active)
    return () => {
      document.body.style.paddingTop = prev;
    };
  }, [active]);

  if (!active) return null;
  const name = getChildViewName();

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-10 items-center justify-center gap-3 bg-primary-500 px-4 text-primary-50 shadow-md">
      <Eye weight="fill" className="size-4 shrink-0" aria-hidden />
      <span className="text-caption font-medium">
        Student view · {name || "your child"} · read only
      </span>
      <button
        onClick={async () => {
          setExiting(true);
          await exitChildView();
        }}
        disabled={exiting}
        className="ms-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-caption font-semibold transition-opacity disabled:opacity-60"
      >
        <SignOut className="size-3.5" aria-hidden />
        Exit student view
      </button>
    </div>
  );
}
