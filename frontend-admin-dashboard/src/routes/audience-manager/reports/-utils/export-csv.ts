/**
 * Shared client-side CSV export for the Reports Center tabs — every tabular
 * report tab exports the rows it has ALREADY loaded (no extra fetching).
 *
 * RFC-4180 with a UTF-8 BOM so Excel renders unicode names correctly, plus
 * spreadsheet formula-injection neutralization.
 */

export type CsvCell = string | number | null | undefined;

const sanitizeCell = (value: CsvCell): string => {
    let s = value == null ? '' : String(value);
    // Neutralize formula injection (=, +, @, leading tab/CR) in spreadsheet apps.
    if (/^[=+@\t\r]/.test(s)) s = `'${s}`;
    // Quote when the value contains a comma, quote or newline.
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
};

export const buildCsv = (headers: string[], rows: CsvCell[][]): string =>
    [headers, ...rows].map((row) => row.map(sanitizeCell).join(',')).join('\r\n');

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

/** One-call helper: build + download. */
export const exportCsv = (filename: string, headers: string[], rows: CsvCell[][]): void =>
    downloadCsv(filename, buildCsv(headers, rows));
