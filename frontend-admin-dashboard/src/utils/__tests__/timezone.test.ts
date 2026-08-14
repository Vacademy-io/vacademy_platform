import { describe, it, expect } from 'vitest';
import { normalizeTimezone, isValidTimezone, FALLBACK_TIMEZONE } from '../timezone';

describe('normalizeTimezone', () => {
    it('rewrites the legacy alias prod Postgres no longer resolves', () => {
        // The 2026-08-14 outage: older ICU builds report this, PG 16.14 rejects it.
        expect(normalizeTimezone('Asia/Calcutta')).toBe('Asia/Kolkata');
    });

    it('rewrites other legacy IANA aliases', () => {
        expect(normalizeTimezone('Asia/Saigon')).toBe('Asia/Ho_Chi_Minh');
        expect(normalizeTimezone('Europe/Kiev')).toBe('Europe/Kyiv');
    });

    it('matches aliases case-insensitively', () => {
        expect(normalizeTimezone('asia/calcutta')).toBe('Asia/Kolkata');
        expect(normalizeTimezone('ASIA/CALCUTTA')).toBe('Asia/Kolkata');
    });

    it('repairs the typos found in prod live_session rows', () => {
        expect(normalizeTimezone('Asia/Culcutta')).toBe('Asia/Kolkata');
        expect(normalizeTimezone('Europ/London')).toBe('Europe/London');
    });

    it('strips quotes left by the bad seed import', () => {
        // Rows exist with a literal quoted value, quotes included.
        expect(normalizeTimezone("'Europe/London'")).toBe('Europe/London');
        expect(normalizeTimezone('"Asia/Kolkata"')).toBe('Asia/Kolkata');
    });

    it('passes valid zones through untouched', () => {
        expect(normalizeTimezone('Asia/Kolkata')).toBe('Asia/Kolkata');
        expect(normalizeTimezone('America/New_York')).toBe('America/New_York');
        expect(normalizeTimezone('UTC')).toBe('UTC');
    });

    it('does not rewrite zones Postgres already accepts', () => {
        // These read like legacy aliases but resolve fine in prod's pg_timezone_names.
        // Rewriting them would silently override the admin's stated choice.
        expect(normalizeTimezone('Australia/Canberra')).toBe('Australia/Canberra');
        expect(normalizeTimezone('Asia/Tel_Aviv')).toBe('Asia/Tel_Aviv');
        expect(normalizeTimezone('Europe/Nicosia')).toBe('Europe/Nicosia');
    });

    it('falls back on absent or unusable input', () => {
        expect(normalizeTimezone(null)).toBe(FALLBACK_TIMEZONE);
        expect(normalizeTimezone(undefined)).toBe(FALLBACK_TIMEZONE);
        expect(normalizeTimezone('')).toBe(FALLBACK_TIMEZONE);
        expect(normalizeTimezone('   ')).toBe(FALLBACK_TIMEZONE);
        expect(normalizeTimezone('Not/AZone')).toBe(FALLBACK_TIMEZONE);
    });

    it('honours an explicit fallback', () => {
        expect(normalizeTimezone(null, 'Europe/London')).toBe('Europe/London');
        expect(normalizeTimezone('Not/AZone', 'Europe/London')).toBe('Europe/London');
    });

    it('never returns a value the platform cannot resolve', () => {
        const inputs = [
            'Asia/Calcutta',
            'Asia/Culcutta',
            "'Europe/London'",
            'Europ/London',
            'Not/AZone',
            '',
            null,
        ];
        for (const input of inputs) {
            expect(isValidTimezone(normalizeTimezone(input))).toBe(true);
        }
    });
});
