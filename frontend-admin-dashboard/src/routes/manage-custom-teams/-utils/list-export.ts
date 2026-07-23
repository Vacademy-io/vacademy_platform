/**
 * Shared CSV-export + date helpers for the Manage VLEs listings (the sub-org/VLE
 * list and the registration-links Registrations dialog).
 */

/** RFC-4180 escaping: quote when the value contains a comma, quote, or newline. */
export const csvCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Rows of already-picked values → one CSV string under the given header row. */
export const buildCsv = (headers: readonly string[], rows: unknown[][]): string => {
    const lines = [headers.join(',')];
    rows.forEach((row) => lines.push(row.map(csvCell).join(',')));
    return lines.join('\n');
};

export const downloadCsv = (csv: string, filename: string) => {
    // Prefix a BOM so Excel opens UTF-8 (accented city/org names) correctly.
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
};

/** "-" for missing/invalid dates; locale short date otherwise. */
export const formatDate = (value?: string | number | null) => {
    if (value === null || value === undefined || value === '') return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};
