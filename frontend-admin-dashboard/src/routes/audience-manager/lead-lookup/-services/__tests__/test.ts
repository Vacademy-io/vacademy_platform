import { describe, expect, it } from 'vitest';
import {
    splitLookupTerm,
    isLookupTermComplete,
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
