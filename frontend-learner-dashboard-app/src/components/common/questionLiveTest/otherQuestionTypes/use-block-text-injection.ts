import { useEffect } from "react";
import { useAssessmentStore } from "@/stores/assessment-store";
import { recordBlockedInjection, recordInput } from "@/lib/writing-signals";

/**
 * Input types that put text in the box without the learner typing it. The
 * `paste` event covers Ctrl+V and the long-press menu; these catch what it
 * misses - text dragged in from another window, and browsers or keyboards
 * that insert clipboard text as a beforeinput without a paste event.
 */
const INJECTED_INPUT_TYPES = new Set([
  "insertFromPaste",
  "insertFromPasteAsQuotation",
  "insertFromDrop",
  "insertFromYank",
]);

export const isInjectedInput = (inputType: string | undefined) =>
  !!inputType && INJECTED_INPUT_TYPES.has(inputType);

/**
 * Lock a typed-answer box to typing only, as the coding editor already is.
 * Takes the element (from a callback ref) rather than a ref object so the
 * listeners attach whenever the box actually mounts. With a `questionId` it
 * also records how the answer was written (see writing-signals.ts).
 */
export function useBlockTextInjection(
  el: HTMLTextAreaElement | HTMLInputElement | null,
  questionId?: string,
) {
  useEffect(() => {
    if (!el) return;
    const attemptId = () =>
      useAssessmentStore.getState().assessment?.attempt_id;
    const blocked = () => {
      if (questionId) recordBlockedInjection(attemptId(), questionId);
    };
    const block = (event: Event) => {
      event.preventDefault();
      if (event.type !== "contextmenu") blocked();
    };
    const blockInjected = (event: Event) => {
      const input = event as InputEvent;
      if (isInjectedInput(input.inputType)) {
        event.preventDefault();
        blocked();
        return;
      }
      if (questionId) {
        recordInput(
          attemptId(),
          questionId,
          input.inputType ?? "",
          input.data ?? null,
        );
      }
    };
    el.addEventListener("paste", block);
    el.addEventListener("drop", block);
    el.addEventListener("contextmenu", block);
    el.addEventListener("beforeinput", blockInjected);
    return () => {
      el.removeEventListener("paste", block);
      el.removeEventListener("drop", block);
      el.removeEventListener("contextmenu", block);
      el.removeEventListener("beforeinput", blockInjected);
    };
  }, [el, questionId]);
}
