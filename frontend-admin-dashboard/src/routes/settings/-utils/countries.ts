/**
 * Country list for the white-label "preferred countries" picker.
 *
 * Sourced from `country-telephone-data` — the same upstream dataset that
 * `react-phone-input-2` derives its country data from. Using this package
 * keeps our selector perfectly aligned with what the actual phone input
 * accepts (ISO 3166-1 alpha-2 codes, lowercase).
 *
 * Flag emojis are derived from the country code at runtime via
 * `countryCodeToFlag` so we don't need to hard-code unicode literals.
 */

// `country-telephone-data` ships no TypeScript types, so we declare the shape
// of the import locally. The package is stable (forked from the same source
// react-phone-input-2 uses) and only exports these three keys.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — no @types/country-telephone-data on npm
import { allCountries as rawAllCountries } from 'country-telephone-data';

interface RawCountryEntry {
    name: string;
    iso2: string;
    dialCode: string;
    priority?: number;
    format?: string;
}

export interface CountryOption {
    /** Lowercase ISO 3166-1 alpha-2 country code, e.g. "in", "us". */
    code: string;
    /** Human-readable display name (native-script parenthetical stripped). */
    name: string;
    /** Original name including any native-script in parens — used for search. */
    nameFull: string;
    /** Dial code with leading "+", e.g. "+91". */
    dialCode: string;
}

/** Convert a 2-letter country code to its flag emoji using regional indicators. */
export const countryCodeToFlag = (code: string): string => {
    if (!code || code.length !== 2) return '';
    const upper = code.toUpperCase();
    const A = 0x1f1e6;
    const aCode = 'A'.charCodeAt(0);
    return String.fromCodePoint(
        A + (upper.charCodeAt(0) - aCode),
        A + (upper.charCodeAt(1) - aCode)
    );
};

/**
 * Strips the native-script parenthetical that `country-telephone-data` appends
 * to many country names — e.g. "Afghanistan (‫افغانستان‬‎)" → "Afghanistan".
 * Falls back to the original string if there's no parenthetical.
 */
const cleanCountryName = (raw: string): string => {
    const idx = raw.indexOf(' (');
    return idx > 0 ? raw.slice(0, idx) : raw;
};

/**
 * Full country list, sorted alphabetically by display name.
 *
 * `country-telephone-data` provides 250+ entries; some have multiple rows for
 * the same ISO code (e.g. "+1" for US and Canada). We dedupe on `iso2` so the
 * picker shows one row per country — that's the granularity our config stores.
 */
export const COUNTRIES: CountryOption[] = (() => {
    const seen = new Set<string>();
    const list: CountryOption[] = [];
    for (const c of rawAllCountries as RawCountryEntry[]) {
        if (!c.iso2 || seen.has(c.iso2)) continue;
        seen.add(c.iso2);
        list.push({
            code: c.iso2.toLowerCase(),
            name: cleanCountryName(c.name),
            nameFull: c.name,
            dialCode: `+${c.dialCode}`,
        });
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
})();

const COUNTRY_BY_CODE: Record<string, CountryOption> = COUNTRIES.reduce(
    (acc, c) => {
        acc[c.code] = c;
        return acc;
    },
    {} as Record<string, CountryOption>
);

export const findCountry = (code: string): CountryOption | undefined =>
    COUNTRY_BY_CODE[code.toLowerCase()];

/**
 * Parses a comma-separated country code string into a normalized array
 * (lowercase, trimmed, dedup, only known codes preserved in input order).
 */
export const parsePreferredCountriesString = (raw: string | null | undefined): string[] => {
    if (!raw) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const part of raw.split(',')) {
        const code = part.trim().toLowerCase();
        if (!code || seen.has(code)) continue;
        if (!COUNTRY_BY_CODE[code]) continue;
        seen.add(code);
        result.push(code);
    }
    return result;
};

/** Joins an array of country codes back into the comma-separated DB format. */
export const stringifyPreferredCountries = (codes: string[]): string =>
    codes.map((c) => c.toLowerCase()).join(',');
