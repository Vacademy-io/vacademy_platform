interface Props {
  actual: string;
  expected: string;
}

function firstDiffIndex(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

/**
 * Line-level diff between a learner's stdout and the expected stdout. Lines
 * that differ are highlighted red; trailing lines present on only one side
 * show as inserted/missing. A trailing note points at the first differing
 * character so long near-match outputs (whitespace, off-by-one digit) are
 * easy to spot without squinting.
 */
export function OutputDiff({ actual, expected }: Props) {
  const a = actual.replace(/\r\n/g, "\n");
  const e = expected.replace(/\r\n/g, "\n");
  const aLines = a.split("\n");
  const eLines = e.split("\n");
  const maxLen = Math.max(aLines.length, eLines.length);

  const rows: Array<{ a?: string; e?: string; diff: boolean }> = [];
  for (let i = 0; i < maxLen; i++) {
    const av = aLines[i];
    const ev = eLines[i];
    rows.push({ a: av, e: ev, diff: av !== ev });
  }

  const idx = firstDiffIndex(a, e);
  const firstDiffMsg =
    idx < 0
      ? null
      : idx >= a.length
        ? `Expected ${e.length - a.length} more character(s) at position ${a.length}`
        : idx >= e.length
          ? `Extra ${a.length - e.length} character(s) at position ${e.length}`
          : `First mismatch at char ${idx}: got ${JSON.stringify(a[idx])}, expected ${JSON.stringify(e[idx])}`;

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[auto,1fr,1fr] gap-x-2 rounded border bg-white p-1 font-mono text-2xs">
        <div className="col-span-1" />
        <div className="text-3xs font-semibold uppercase text-gray-500">
          Your output
        </div>
        <div className="text-3xs font-semibold uppercase text-gray-500">
          Expected
        </div>
        {rows.map((r, i) => (
          <Row key={i} idx={i + 1} a={r.a} e={r.e} diff={r.diff} />
        ))}
      </div>
      {firstDiffMsg && (
        <div className="text-2xs text-red-700">{firstDiffMsg}</div>
      )}
    </div>
  );
}

function Row({
  idx,
  a,
  e,
  diff,
}: {
  idx: number;
  a?: string;
  e?: string;
  diff: boolean;
}) {
  const bg = diff ? "bg-red-50" : "";
  return (
    <>
      <div className={`px-1 text-right text-gray-400 ${bg}`}>{idx}</div>
      <div className={`whitespace-pre break-all px-1 ${bg}`}>
        {a === undefined ? (
          <span className="text-gray-400">—</span>
        ) : a === "" ? (
          <span className="text-gray-400">(empty)</span>
        ) : (
          a
        )}
      </div>
      <div className={`whitespace-pre break-all px-1 ${bg}`}>
        {e === undefined ? (
          <span className="text-gray-400">—</span>
        ) : e === "" ? (
          <span className="text-gray-400">(empty)</span>
        ) : (
          e
        )}
      </div>
    </>
  );
}
