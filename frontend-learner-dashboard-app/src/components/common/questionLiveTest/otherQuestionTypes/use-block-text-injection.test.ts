import { describe, expect, it } from "vitest";
import { isInjectedInput } from "./use-block-text-injection";

describe("isInjectedInput", () => {
  it("blocks text that arrives without being typed", () => {
    for (const type of [
      "insertFromPaste",
      "insertFromPasteAsQuotation",
      "insertFromDrop",
      "insertFromYank",
    ]) {
      expect(isInjectedInput(type)).toBe(true);
    }
  });

  it("leaves typing, deleting, autocorrect and IME composition alone", () => {
    for (const type of [
      "insertText",
      "insertLineBreak",
      "deleteContentBackward",
      "insertReplacementText",
      "insertCompositionText",
      undefined,
    ]) {
      expect(isInjectedInput(type)).toBe(false);
    }
  });
});
