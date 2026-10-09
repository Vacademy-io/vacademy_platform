import { describe, expect, it } from 'vitest';
import {
    splitLookupTerm,
    isLookupTermComplete,
    isTermCompleteFor,
    lookupParamsFor,
    guessLookupMode,
} from '@/routes/audience-manager/lead-lookup/-services/lead-lookup';

describe('splitLookupTerm', () => {
    it('treats anything with an @ as an email', () => {
        expect(splitLookupTerm('ram@example.com')).toEqual({ email: 'ram@example.com' });
        expect(splitLookupTerm('9876543210')).toEqual({ phone: '9876543210' });
    });

    it('ignores surrounding whitespace', () => {
        expect(splitLookupTerm('  9876543210 ')).toEqual({ phone: '9876543210' });
        expect(splitLookupTerm('   ')).toEqual({});
    });
});

describe('isLookupTermComplete', () => {
    it('rejects a partial number — it would match whoever shares the suffix', () => {
        expect(isLookupTermComplete('98765')).toBe(false);
        expect(isLookupTermComplete('987654321')).toBe(false);
        expect(isLookupTermComplete('9876543210')).toBe(true);
    });

    it('accepts a number written with a country code or separators', () => {
        expect(isLookupTermComplete('+91 98765-43210')).toBe(true);
        expect(isLookupTermComplete('919876543210')).toBe(true);
    });

    it('needs a whole email, not a fragment', () => {
        expect(isLookupTermComplete('ram@')).toBe(false);
        expect(isLookupTermComplete('ram@example')).toBe(false);
        expect(isLookupTermComplete('ram@example.com')).toBe(true);
    });

    it('rejects an empty box', () => {
        expect(isLookupTermComplete('')).toBe(false);
        expect(isLookupTermComplete('   ')).toBe(false);
    });
});

/**
 * The three search modes. Phone and email keep the rules they always had; name
 * is the new one, and it is the only mode an institute has to switch on. The
 * backend matches a name in FULL, so "complete" here just means something was
 * actually typed — a first name will send, and correctly find nobody.
 */
describe('isTermCompleteFor', () => {
    it('keeps the phone rule: a partial number would match whoever shares the suffix', () => {
        expect(isTermCompleteFor('phone', '98765')).toBe(false);
        expect(isTermCompleteFor('phone', '9876543210')).toBe(true);
        expect(isTermCompleteFor('phone', '+91 98765-43210')).toBe(true);
    });

    it('keeps the email rule: a fragment is not an address', () => {
        expect(isTermCompleteFor('email', 'ram@')).toBe(false);
        expect(isTermCompleteFor('email', 'ram@example.com')).toBe(true);
    });

    // A phone typed while the mode says email is the user's mistake to see, not
    // something to silently re-route — the modes are explicit now.
    it('does not re-interpret a value that suits another mode', () => {
        expect(isTermCompleteFor('email', '9876543210')).toBe(false);
        expect(isTermCompleteFor('phone', 'ram@example.com')).toBe(false);
    });

    it('accepts a name once it is more than a couple of letters', () => {
        expect(isTermCompleteFor('name', 'A')).toBe(false);
        expect(isTermCompleteFor('name', 'Asha Kulkarni')).toBe(true);
    });

    it.each(['phone', 'email', 'name'] as const)('rejects an empty box in %s mode', (mode) => {
        expect(isTermCompleteFor(mode, '')).toBe(false);
        expect(isTermCompleteFor(mode, '   ')).toBe(false);
    });
});

describe('lookupParamsFor', () => {
    it('sends the term under the key the chosen mode owns', () => {
        expect(lookupParamsFor('phone', ' 9876543210 ')).toEqual({ phone: '9876543210' });
        expect(lookupParamsFor('email', 'ram@example.com')).toEqual({ email: 'ram@example.com' });
        expect(lookupParamsFor('name', 'Asha Kulkarni')).toEqual({ name: 'Asha Kulkarni' });
    });

    it('sends nothing for an empty box, so the request is never made on a blank', () => {
        expect(lookupParamsFor('name', '   ')).toEqual({});
    });
});

describe('guessLookupMode', () => {
    it.each([
        ['ram@example.com', 'email'],
        ['9876543210', 'phone'],
        ['+91 98765-43210', 'phone'],
        ['Asha Kulkarni', 'name'],
    ])('reads %s as %s', (term, expected) => {
        expect(guessLookupMode(term)).toBe(expected);
    });

    it('has no opinion on an empty box', () => {
        expect(guessLookupMode('  ')).toBeNull();
    });
});
