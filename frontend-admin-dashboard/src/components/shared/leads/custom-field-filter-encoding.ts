/**
 * Sentinel encoding for typed custom-field filter selections.
 *
 * All four list surfaces keep per-field selections as a plain `string[]`
 * (leads: Record<fieldId, string[]>; contacts/students: columnFilters values),
 * so typed operators ride inside that array as sentinel-encoded strings and
 * are decoded into `[{field_id, operator, values}]` entries at payload-build
 * time. Plain (non-sentinel) strings remain an IN entry, exactly as before.
 *
 * Sentinels:
 *   __EMPTY__                → { operator: 'IS_EMPTY' }
 *   __NOT_EMPTY__            → { operator: 'NOT_EMPTY' }
 *   __CONTAINS__:<text>      → { operator: 'CONTAINS', values: [text] } (merge)
 *   __RANGE__:<json>         → { operator, values } from {"op":"BETWEEN","values":[..]}
 */

export type CustomFieldOperator =
    | 'IN'
    | 'CONTAINS'
    | 'IS_EMPTY'
    | 'NOT_EMPTY'
    | 'BETWEEN'
    | 'GTE'
    | 'LTE';

export interface CustomFieldFilterEntry {
    field_id: string;
    operator?: CustomFieldOperator;
    values: string[];
}

export const EMPTY_SENTINEL = '__EMPTY__';
export const NOT_EMPTY_SENTINEL = '__NOT_EMPTY__';
const CONTAINS_PREFIX = '__CONTAINS__:';
const RANGE_PREFIX = '__RANGE__:';

export const encodeContains = (text: string): string => `${CONTAINS_PREFIX}${text}`;

export const encodeRange = (op: 'BETWEEN' | 'GTE' | 'LTE', values: string[]): string =>
    `${RANGE_PREFIX}${JSON.stringify({ op, values })}`;

export const isSentinelValue = (value: string): boolean =>
    value === EMPTY_SENTINEL ||
    value === NOT_EMPTY_SENTINEL ||
    value.startsWith(CONTAINS_PREFIX) ||
    value.startsWith(RANGE_PREFIX);

/** Human label for a sentinel value (chips, selected-value lists); null for plain values. */
export function sentinelLabel(value: string): string | null {
    if (value === EMPTY_SENTINEL) return '(empty)';
    if (value === NOT_EMPTY_SENTINEL) return '(not empty)';
    if (value.startsWith(CONTAINS_PREFIX))
        return `contains "${value.slice(CONTAINS_PREFIX.length)}"`;
    if (value.startsWith(RANGE_PREFIX)) {
        const decoded = decodeRange(value);
        if (!decoded) return '(range)';
        if (decoded.operator === 'BETWEEN') return `${decoded.values[0]} – ${decoded.values[1]}`;
        if (decoded.operator === 'GTE') return `≥ ${decoded.values[0]}`;
        return `≤ ${decoded.values[0]}`;
    }
    return null;
}

export function decodeRange(
    value: string
): { operator: 'BETWEEN' | 'GTE' | 'LTE'; values: string[] } | null {
    if (!value.startsWith(RANGE_PREFIX)) return null;
    try {
        const parsed = JSON.parse(value.slice(RANGE_PREFIX.length)) as {
            op?: string;
            values?: string[];
        };
        if (
            (parsed.op === 'BETWEEN' || parsed.op === 'GTE' || parsed.op === 'LTE') &&
            Array.isArray(parsed.values)
        ) {
            return { operator: parsed.op, values: parsed.values };
        }
    } catch {
        // fall through — malformed sentinel is dropped by the decoder
    }
    return null;
}

/**
 * Decode one field's selection array into wire entries. Plain values form a
 * single IN entry; each sentinel becomes (or merges into) its operator entry.
 * Entries for the same field AND together server-side.
 */
export function decodeSelectionToEntries(
    fieldId: string,
    selected: string[]
): CustomFieldFilterEntry[] {
    const entries: CustomFieldFilterEntry[] = [];
    const plain: string[] = [];
    const contains: string[] = [];
    for (const value of selected) {
        if (value === EMPTY_SENTINEL) {
            entries.push({ field_id: fieldId, operator: 'IS_EMPTY', values: [] });
        } else if (value === NOT_EMPTY_SENTINEL) {
            entries.push({ field_id: fieldId, operator: 'NOT_EMPTY', values: [] });
        } else if (value.startsWith(CONTAINS_PREFIX)) {
            contains.push(value.slice(CONTAINS_PREFIX.length));
        } else if (value.startsWith(RANGE_PREFIX)) {
            const range = decodeRange(value);
            if (range) {
                entries.push({ field_id: fieldId, operator: range.operator, values: range.values });
            }
        } else {
            plain.push(value);
        }
    }
    if (contains.length > 0) {
        entries.push({ field_id: fieldId, operator: 'CONTAINS', values: contains });
    }
    if (plain.length > 0) {
        entries.push({ field_id: fieldId, values: plain });
    }
    return entries;
}

/**
 * Split a per-field selection record into the students endpoint's two payload
 * halves: the legacy values-IN map (plain values, unchanged wire shape) and
 * the typed operator entries (decoded sentinels).
 */
export function splitLegacyAndTyped(record: Record<string, string[]>): {
    legacy: Record<string, string[]>;
    typed: CustomFieldFilterEntry[];
} {
    const legacy: Record<string, string[]> = {};
    const typed: CustomFieldFilterEntry[] = [];
    for (const [fieldId, values] of Object.entries(record)) {
        if (values.length === 0) continue;
        for (const entry of decodeSelectionToEntries(fieldId, values)) {
            if (!entry.operator || entry.operator === 'IN') {
                legacy[fieldId] = entry.values;
            } else {
                typed.push(entry);
            }
        }
    }
    return { legacy, typed };
}

/**
 * Remove exactly the selection values backing one decoded entry — used by
 * active-filter chips so removing the "contains x" chip doesn't also clear the
 * field's plain value selections (one field can yield several chips).
 */
export function removeEntryFromSelection(
    selected: string[],
    entry: CustomFieldFilterEntry
): string[] {
    switch (entry.operator ?? 'IN') {
        case 'IS_EMPTY':
            return selected.filter((v) => v !== EMPTY_SENTINEL);
        case 'NOT_EMPTY':
            return selected.filter((v) => v !== NOT_EMPTY_SENTINEL);
        case 'CONTAINS':
            return selected.filter(
                (v) =>
                    !v.startsWith(CONTAINS_PREFIX) ||
                    !entry.values.includes(v.slice(CONTAINS_PREFIX.length))
            );
        case 'BETWEEN':
        case 'GTE':
        case 'LTE':
            return selected.filter((v) => {
                const range = decodeRange(v);
                if (!range) return true;
                return !(
                    range.operator === entry.operator &&
                    JSON.stringify(range.values) === JSON.stringify(entry.values)
                );
            });
        default:
            // IN chip → drop the plain values, keep sentinels.
            return selected.filter((v) => isSentinelValue(v) || !entry.values.includes(v));
    }
}

/** Human label for one decoded filter entry's value side (active-filter chips). */
export function filterEntryValueLabel(entry: CustomFieldFilterEntry): string {
    switch (entry.operator ?? 'IN') {
        case 'IS_EMPTY':
            return 'empty';
        case 'NOT_EMPTY':
            return 'has any value';
        case 'CONTAINS':
            return `contains ${entry.values.map((v) => `"${v}"`).join(', ')}`;
        case 'BETWEEN':
            return `${entry.values[0]} – ${entry.values[1]}`;
        case 'GTE':
            return `≥ ${entry.values[0]}`;
        case 'LTE':
            return `≤ ${entry.values[0]}`;
        default:
            return entry.values.join(', ');
    }
}

/** Whether a custom field's type gets the range popover instead of the multi-select. */
export function isRangeFieldType(fieldType: string | undefined | null): boolean {
    const type = (fieldType ?? '').toUpperCase();
    return type === 'NUMBER' || type === 'DATE' || type === 'DATETIME';
}
