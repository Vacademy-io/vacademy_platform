import { useState } from "react";
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

  if (!isChildViewActive()) return null;
  const name = getChildViewName();

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-primary-500 px-4 py-2 text-primary-50 shadow-md">
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
