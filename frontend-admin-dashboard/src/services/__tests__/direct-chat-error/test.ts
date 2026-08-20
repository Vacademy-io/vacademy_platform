import { describe, expect, it } from 'vitest';
import { describeDirectChatError } from '@/services/chat/chatApi';

const FALLBACK = "Couldn't open the chat. Please try again.";

const httpError = (status: number, message?: string) => ({
    response: { status, data: message ? { message } : {} },
});

/**
 * Opening a mentor↔student DM fails permanently on several 403s, and telling
 * someone to "try again" on those sends them round a loop that can never finish.
 * Chat being OFF is the DEFAULT institute state, so CHAT_DISABLED is the case that
 * actually reaches users.
 */
describe('describeDirectChatError', () => {
    it('names the real cause when chat is switched off for the institute', () => {
        const out = describeDirectChatError(httpError(403, 'CHAT_DISABLED'), FALLBACK);
        expect(out).not.toBe(FALLBACK);
        expect(out).toMatch(/turned off/i);
        expect(out).not.toMatch(/try again/i);
    });

    it('explains a role pair the institute forbids', () => {
        const out = describeDirectChatError(httpError(403, 'DM_NOT_ALLOWED'), FALLBACK);
        expect(out).toMatch(/don't allow direct messages/i);
        expect(out).not.toMatch(/try again/i);
    });

    it('handles the remaining deterministic rejections', () => {
        expect(describeDirectChatError(httpError(400, 'CANNOT_DM_SELF'), FALLBACK)).toMatch(
            /yourself/i
        );
        expect(describeDirectChatError(httpError(400, 'TARGET_REQUIRED'), FALLBACK)).toMatch(
            /account is missing/i
        );
    });

    it('reads the code out of a longer server message', () => {
        const out = describeDirectChatError(
            httpError(403, '403 FORBIDDEN "CHAT_DISABLED"'),
            FALLBACK
        );
        expect(out).toMatch(/turned off/i);
    });

    it('keeps the retry wording for genuinely transient failures', () => {
        // A 5xx or a network error may well succeed next time.
        expect(describeDirectChatError(httpError(500, 'boom'), FALLBACK)).toBe(FALLBACK);
        expect(describeDirectChatError(new Error('Network Error'), FALLBACK)).toBe(FALLBACK);
        expect(describeDirectChatError(undefined, FALLBACK)).toBe(FALLBACK);
    });

    it('falls back when a 4xx carries no recognised code', () => {
        expect(describeDirectChatError(httpError(400, 'SOMETHING_NEW'), FALLBACK)).toBe(FALLBACK);
        expect(describeDirectChatError(httpError(403), FALLBACK)).toBe(FALLBACK);
    });
});
