import { describe, expect, it } from "vitest";
import {
  PAUSE_MS,
  recordBlockedInjection,
  recordFocusLoss,
  recordInput,
  restoreWritingSignals,
  snapshotWritingSignals,
} from "./writing-signals";

describe("writing signals", () => {
  it("counts typing, deletions, large inserts and pauses per question", () => {
    const t0 = 1_000_000;
    recordInput("att-1", "q1", "insertText", "D", t0);
    recordInput("att-1", "q1", "insertText", "e", t0 + 200);
    recordInput("att-1", "q1", "deleteContentBackward", null, t0 + 400);
    recordInput("att-1", "q1", "insertText", "x".repeat(120), t0 + 600);
    recordInput("att-1", "q1", "insertText", "a", t0 + 600 + PAUSE_MS + 1);
    recordBlockedInjection("att-1", "q1");
    recordFocusLoss("att-1", "q1");

    const q1 = snapshotWritingSignals("att-1").q1;
    expect(q1.keystrokes).toBe(3);
    expect(q1.typedChars).toBe(3);
    expect(q1.deletions).toBe(1);
    expect(q1.largeInserts).toBe(1);
    expect(q1.largeInsertChars).toBe(120);
    expect(q1.pauses).toBe(1);
    expect(q1.activeMs).toBe(600);
    expect(q1.blockedInjections).toBe(1);
    expect(q1.focusLosses).toBe(1);
  });

  it("never mixes attempts, and survives a reload", () => {
    recordInput("att-2", "q1", "insertText", "h", 1);
    expect(snapshotWritingSignals("att-1")).toEqual({});
    const saved = snapshotWritingSignals("att-2");
    restoreWritingSignals("att-3", { q9: { ...saved.q1, keystrokes: 7 } });
    expect(snapshotWritingSignals("att-3").q9.keystrokes).toBe(7);
  });

  it("records nothing without an attempt", () => {
    recordInput(undefined, "q1", "insertText", "h");
    recordFocusLoss("att-3", undefined);
    expect(snapshotWritingSignals(undefined)).toEqual({});
  });
});
