/**
 * How a typed answer was written, per question, for the teacher's "Writing
 * integrity" panel. Counts only - never the keystrokes themselves.
 *
 * Kept outside the zustand store on purpose: it changes on every keystroke and
 * nothing on screen reads it, so putting it in the store would re-render the
 * player once more per key. saveState/loadState persist it with the rest of
 * the attempt, and formatDataFromStore sends it with online saves and submits.
 */
export interface WritingSignals {
  /** Typing events (characters, line breaks). */
  keystrokes: number;
  /** Characters that arrived by typing. */
  typedChars: number;
  /** Delete / backspace events. */
  deletions: number;
  /** Single inserts of LARGE_INSERT_CHARS or more: keyboard clipboard chips, dictation. */
  largeInserts: number;
  largeInsertChars: number;
  /** Paste, drop and clipboard inserts that were blocked. */
  blockedInjections: number;
  /** Gaps of PAUSE_MS or longer between two inputs. */
  pauses: number;
  /** Time spent writing: the sum of the shorter gaps between inputs. */
  activeMs: number;
  /** Times the learner left the test window while on this question. */
  focusLosses: number;
  firstInputAt?: number;
  lastInputAt?: number;
}

export const LARGE_INSERT_CHARS = 40;
export const PAUSE_MS = 30_000;

type Store = {
  attemptId: string | null;
  byQuestion: Record<string, WritingSignals>;
};

let store: Store = { attemptId: null, byQuestion: {} };

const empty = (): WritingSignals => ({
  keystrokes: 0,
  typedChars: 0,
  deletions: 0,
  largeInserts: 0,
  largeInsertChars: 0,
  blockedInjections: 0,
  pauses: 0,
  activeMs: 0,
  focusLosses: 0,
});

const signalsFor = (attemptId: string, questionId: string): WritingSignals => {
  if (store.attemptId !== attemptId) {
    store = { attemptId, byQuestion: {} };
  }
  return (store.byQuestion[questionId] ??= empty());
};

const markInput = (s: WritingSignals, now: number) => {
  if (s.lastInputAt !== undefined) {
    const gap = now - s.lastInputAt;
    if (gap >= PAUSE_MS) s.pauses += 1;
    else if (gap > 0) s.activeMs += gap;
  }
  s.firstInputAt ??= now;
  s.lastInputAt = now;
};

/** One beforeinput that was allowed through. */
export function recordInput(
  attemptId: string | undefined,
  questionId: string,
  inputType: string,
  data: string | null,
  now = Date.now(),
) {
  if (!attemptId) return;
  const s = signalsFor(attemptId, questionId);
  if (inputType.startsWith("delete")) {
    s.deletions += 1;
  } else if (inputType.startsWith("insert")) {
    const length = data?.length ?? (inputType === "insertLineBreak" ? 1 : 0);
    if (length >= LARGE_INSERT_CHARS) {
      s.largeInserts += 1;
      s.largeInsertChars += length;
    } else {
      s.keystrokes += 1;
      s.typedChars += length;
    }
  } else {
    return;
  }
  markInput(s, now);
}

export function recordBlockedInjection(
  attemptId: string | undefined,
  questionId: string,
) {
  if (!attemptId) return;
  signalsFor(attemptId, questionId).blockedInjections += 1;
}

export function recordFocusLoss(
  attemptId: string | undefined,
  questionId: string | undefined,
) {
  if (!attemptId || !questionId) return;
  signalsFor(attemptId, questionId).focusLosses += 1;
}

/** What to persist or send for this attempt; {} when nothing was recorded. */
export function snapshotWritingSignals(
  attemptId: string | undefined,
): Record<string, WritingSignals> {
  if (!attemptId || store.attemptId !== attemptId) return {};
  return JSON.parse(JSON.stringify(store.byQuestion));
}

/** Put back what saveState persisted, after a reload mid-attempt. */
export function restoreWritingSignals(
  attemptId: string | undefined,
  saved: unknown,
) {
  if (!attemptId || !saved || typeof saved !== "object") return;
  store = { attemptId, byQuestion: JSON.parse(JSON.stringify(saved)) };
}
