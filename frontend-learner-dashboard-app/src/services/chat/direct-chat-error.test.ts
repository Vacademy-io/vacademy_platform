import { describe, expect, it } from "vitest";
import { describeDirectChatError } from "./direct-chat-error";

const FALLBACK = "Couldn't open the chat. Please try again.";

const httpError = (status: number, message?: string) => ({
    response: { status, data: message ? { message } : {} },
});

/**
 * Opening a mentor DM fails permanently on several 403s, and telling a learner to
 * "try again" on those sends them round a loop that can never finish. Chat being
 * OFF is the DEFAULT institute state, so CHAT_DISABLED is the case that actually
 * reaches learners.
 */
describe("describeDirectChatError", () => {
    it("says messaging is unavailable when chat is off for the institute", () => {
        const out = describeDirectChatError(httpError(403, "CHAT_DISABLED"), FALLBACK);
        expect(out).toMatch(/isn't available/i);
        expect(out).not.toMatch(/try again/i);
    });

    it("explains a role pair the institute forbids", () => {
        const out = describeDirectChatError(httpError(403, "DM_NOT_ALLOWED"), FALLBACK);
        expect(out).toMatch(/doesn't allow direct messages/i);
        expect(out).not.toMatch(/try again/i);
    });

    it("handles the remaining deterministic rejections", () => {
        expect(describeDirectChatError(httpError(400, "CANNOT_DM_SELF"), FALLBACK)).toMatch(
            /yourself/i,
        );
        expect(describeDirectChatError(httpError(400, "TARGET_REQUIRED"), FALLBACK)).toMatch(
            /couldn't find/i,
        );
    });

    it("reads the code out of a longer server message", () => {
        expect(
            describeDirectChatError(httpError(403, '403 FORBIDDEN "CHAT_DISABLED"'), FALLBACK),
        ).toMatch(/isn't available/i);
    });

    it("keeps the retry wording for genuinely transient failures", () => {
        expect(describeDirectChatError(httpError(500, "boom"), FALLBACK)).toBe(FALLBACK);
        expect(describeDirectChatError(new Error("Network Error"), FALLBACK)).toBe(FALLBACK);
        expect(describeDirectChatError(undefined, FALLBACK)).toBe(FALLBACK);
    });

    it("falls back when a 4xx carries no recognised code", () => {
        expect(describeDirectChatError(httpError(400, "SOMETHING_NEW"), FALLBACK)).toBe(FALLBACK);
        expect(describeDirectChatError(httpError(403), FALLBACK)).toBe(FALLBACK);
    });
});
