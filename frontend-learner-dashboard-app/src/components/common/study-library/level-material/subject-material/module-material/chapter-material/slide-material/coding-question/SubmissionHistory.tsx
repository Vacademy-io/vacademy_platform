import { useEffect, useState } from "react";
import { CaretDown, CaretRight, Check, X, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { listSubmissions, getSubmission } from "./submission-store";
import { LANGUAGE_REGISTRY } from "./language-registry";
import type { CodingSubmission, Verdict } from "./types";

interface Props {
  slideId: string;
  // Bumped by the parent whenever a new submission is saved so the list refreshes.
  refreshKey: number;
}

const verdictBadge: Record<
  Verdict,
  { label: string; className: string; Icon: typeof Check }
> = {
  ACCEPTED: {
    label: "Accepted",
    className: "bg-green-100 text-green-700 border-green-200",
    Icon: Check,
  },
  PARTIAL: {
    label: "Partial",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    Icon: WarningCircle,
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 border-red-200",
    Icon: X,
  },
  ERROR: {
    label: "Error",
    className: "bg-red-100 text-red-700 border-red-200",
    Icon: X,
  },
  TIMED_OUT: {
    label: "Timed Out",
    className: "bg-red-100 text-red-700 border-red-200",
    Icon: X,
  },
};

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString();
}

export function SubmissionHistory({ slideId, refreshKey }: Props) {
  const [items, setItems] = useState<CodingSubmission[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  // Full-detail rows fetched on expand. The list endpoint returns summaries
  // without source code or per-test results to keep responses small.
  const [details, setDetails] = useState<Record<string, CodingSubmission>>({});

  useEffect(() => {
    let cancelled = false;
    listSubmissions(slideId).then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [slideId, refreshKey]);

  const toggleOpen = (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!details[id]) {
      getSubmission(id).then((d) => {
        if (d) setDetails((prev) => ({ ...prev, [id]: d }));
      });
    }
  };

  if (!items.length) {
    return (
      <div className="rounded border border-dashed p-4 text-center text-sm text-gray-500">
        No submissions yet. Hit <span className="font-medium">Submit</span> to
        record one.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((summary) => {
        const open = openId === summary.id;
        // When expanded, prefer the hydrated detail (has source + per-test
        // results); fall back to the summary while it's loading.
        const s = (open && details[summary.id]) || summary;
        const v = verdictBadge[s.verdict];
        const Icon = v.Icon;
        const hydrated = !open || !!details[summary.id];
        return (
          <div key={s.id} className="rounded border bg-white">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-gray-50"
              onClick={() => toggleOpen(summary.id)}
            >
              {open ? (
                <CaretDown className="size-4" />
              ) : (
                <CaretRight className="size-4" />
              )}
              <span
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${v.className}`}
              >
                <Icon className="size-3" />
                {v.label}
              </span>
              <span className="text-sm font-medium">
                {s.score.toFixed(1)} / {s.maxPoints} pts
              </span>
              <span className="text-xs text-gray-500">
                {s.passedCount}/{s.totalCount} tests
              </span>
              <Badge variant="outline" className="text-3xs">
                {LANGUAGE_REGISTRY[s.language]?.label ?? s.language}
              </Badge>
              <span className="ms-auto text-xs text-gray-500">
                {fmtDate(s.submittedAt)}
              </span>
            </button>

            {open && (
              <div className="border-t p-3 text-sm">
                <div className="mb-2 grid grid-cols-3 gap-3 text-xs text-gray-600">
                  <div>
                    <span className="font-semibold">Total time:</span>{" "}
                    {s.totalTimeMs} ms
                  </div>
                  <div>
                    <span className="font-semibold">Peak memory:</span>{" "}
                    {s.peakMemoryKb} KB
                  </div>
                  <div>
                    <span className="font-semibold">Submitted:</span>{" "}
                    {fmtDate(s.submittedAt)}
                  </div>
                </div>

                {!hydrated && (
                  <div className="mb-2 text-xs text-gray-500">Loading details…</div>
                )}

                <div className="mb-2 space-y-1">
                  {s.results.map((r, i) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 rounded border px-2 py-1 text-xs"
                    >
                      {r.passed ? (
                        <Check className="size-3 text-green-600" />
                      ) : (
                        <X className="size-3 text-red-600" />
                      )}
                      <span className="font-medium">
                        {r.label || `Test ${i + 1}`}
                      </span>
                      <span className="text-gray-500">
                        {r.visible ? "(sample)" : "(hidden)"}
                      </span>
                      {r.timeMs != null && (
                        <span className="ms-auto text-gray-500">
                          {r.timeMs} ms
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <details>
                  <summary className="cursor-pointer text-xs text-gray-600">
                    View submitted code
                  </summary>
                  <pre className="mt-2 max-h-60 overflow-auto rounded bg-gray-900 p-3 text-xs text-green-300">
                    <code>{s.sourceCode}</code>
                  </pre>
                </details>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
