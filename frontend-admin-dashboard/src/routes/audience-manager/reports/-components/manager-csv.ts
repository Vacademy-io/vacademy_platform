/**
 * Minimal RFC-4180 CSV builder + download helper for the Manager tab's
 * client-side exports (the team-rollup comparison table).
 *
 * NOTE ON DUPLICATION: this mirrors the Calling tab's calling-csv.ts (itself a
 * local copy of the shared export-csv util) — file ownership between report
 * agents is disjoint, so each tab co-locates its CSV helper. Fold into the
 * shared ../-utils/export-csv.ts in a later pass.
 */

const sanitizeCell = (value: string | number | null | undefined): string => {
    let s = value == null ? '' : String(value);
    // Neutralize formula injection (=, +, @, leading tab/CR) in spreadsheet apps.
    if (/^[=+@\t\r]/.test(s)) s = `'${s}`;
    // Quote when the value contains a comma, quote or newline.
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
};

export const buildCsv = (
    headers: string[],
    rows: Array<Array<string | number | null | undefined>>
): string => [headers, ...rows].map((row) => row.map(sanitizeCell).join(',')).join('\r\n');

export const downloadCsv = (filename: string, content: string): void => {
    // Prepend a UTF-8 BOM so Excel renders unicode (e.g. names) correctly.
    const bom = String.fromCharCode(0xfeff);
    const blob = new Blob([bom, content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
