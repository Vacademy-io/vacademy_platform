// Bulk offline data entry — CSV manifest + sample-zip helpers.
//
// The zip is read with @zip.js/zip.js (already a dependency, used by bulk content
// uploading): it lists entries from the central directory and streams ONE entry at
// a time, so a 500-sheet scan batch never has to fit in memory at once.

import Papa from 'papaparse';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import type { ZipHandle } from '@/components/common/study-library/bulk-content-uploading/zip-parser';
import type { StudentRow } from '../-components/StudentSelector';

export const MANIFEST_COLUMNS = [
    'username',
    'full_name',
    'total_marks',
    'student_pdf',
    'checked_pdf',
    'report_pdf',
] as const;

// Only the match key is required. Every other column is optional — an admin
// attaching just checked copies should be able to upload a two-column CSV rather
// than carry empty `total_marks`/`report_pdf` headers around. A column that isn't
// there simply contributes nothing, exactly like a blank cell.
const REQUIRED_COLUMNS = ['username'] as const;

export const SAMPLE_FOLDERS = ['answers', 'checked', 'reports'] as const;

export interface ManifestRow {
    /** 1-based CSV line number (excluding the header), for error messages. */
    line: number;
    username: string;
    totalMarks: number | null;
    /** Zip paths, already resolved against the archive's real entries. */
    studentPath: string | null;
    checkedPath: string | null;
    reportPath: string | null;
    /** Resolved student; null when the username matched nobody. */
    student: StudentRow | null;
    /** Blocking problems — a row with any error is not imported. */
    errors: string[];
}

export interface ParsedManifest {
    rows: ManifestRow[];
    validRows: ManifestRow[];
    /** Zip entries no manifest row referenced — usually a typo or a stray scan. */
    unreferencedFiles: string[];
    /** Headers we don't understand — flagged so a typo'd column isn't silent. */
    unrecognizedHeaders: string[];
    /** Problems with the file as a whole (missing username column, unreadable CSV). */
    fatalErrors: string[];
}

const normalizeHeader = (header: string): string =>
    header.trim().toLowerCase().replace(/\s+/g, '_');

const normalizeKey = (value: string | undefined): string => (value ?? '').trim().toLowerCase();

/** Strips folders and case so `Answers/STU001.PDF` still finds `answers/stu001.pdf`. */
const basename = (path: string): string => path.split('/').pop() ?? path;

/**
 * Resolves a manifest cell to a real zip path. Accepts a full path or just the
 * file name — scanners and spreadsheet software both mangle these, and failing an
 * otherwise-correct row over a leading `./` helps nobody.
 */
const resolveZipPath = (cell: string, filesByPath: Map<string, string>, filesByName: Map<string, string[]>) => {
    const raw = cell.trim().replace(/^\.?\//, '');
    if (!raw) return { path: null as string | null, error: null as string | null };

    const byPath = filesByPath.get(raw.toLowerCase());
    if (byPath) return { path: byPath, error: null };

    const matches = filesByName.get(basename(raw).toLowerCase()) ?? [];
    if (matches.length === 1) return { path: matches[0] as string, error: null };
    if (matches.length > 1) {
        return {
            path: null,
            error: `"${raw}" matches ${matches.length} files in the zip — use the full path inside the zip`,
        };
    }
    return { path: null, error: `"${raw}" was not found in the zip` };
};

/** Builds the CSV template, pre-filled with the students in this assessment. */
export const buildManifestCsv = (students: StudentRow[]): string => {
    const rows = students
        .filter((s) => s.username)
        .map((s) => ({
            username: s.username,
            full_name: s.name,
            total_marks: '',
            student_pdf: '',
            checked_pdf: '',
            report_pdf: '',
        }));

    // Even with no students the header alone is a usable template.
    return Papa.unparse({ fields: [...MANIFEST_COLUMNS], data: rows });
};

export const downloadTextFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

const SAMPLE_README = `Bulk offline data entry
=======================

1. Put your scanned PDFs anywhere in this zip. The folders below are only a
   suggestion — manifest.csv is what decides which file is which.

     answers/   the student's own answer sheet
     checked/   the checked (annotated) copy
     reports/   a result report you prepared outside the platform

2. Fill in manifest.csv. ONLY "username" is required — every other column is
   optional. Delete any column you don't need, or leave individual cells blank;
   both mean "skip this one". A two-column file like

     username,checked_pdf

   is perfectly valid.

     username      REQUIRED. The student's enrolment number / username.
                   Must match exactly (case does not matter).
     full_name     Optional, ignored on import — it is there so you can see
                   who is who while filling the sheet in.
     total_marks   Optional. The total the student scored.
     student_pdf   Optional. Path (or just the file name) of their answer
                   sheet in this zip.
     checked_pdf   Optional. Path of the checked copy.
     report_pdf    Optional. Path of the report.

   Each row does need at least one of total_marks / student_pdf / checked_pdf /
   report_pdf — a row with only a username has nothing to import.

3. Zip it back up and upload it. You will see a row-by-row preview before
   anything is saved.

Note: entering total_marks releases that student's result to them.
`;

/** Builds a downloadable sample zip: the pre-filled manifest + folder layout. */
export const buildSampleZip = async (students: StudentRow[]): Promise<Blob> => {
    const zipWriter = new ZipWriter(new BlobWriter('application/zip'));

    await zipWriter.add('manifest.csv', new TextReader(buildManifestCsv(students)));
    await zipWriter.add('README.txt', new TextReader(SAMPLE_README));
    for (const folder of SAMPLE_FOLDERS) {
        await zipWriter.add(`${folder}/`, null, { directory: true });
    }

    return zipWriter.close();
};

/** Finds the manifest inside the zip: `manifest.csv`, else the only root-level CSV. */
export const findManifestPath = (zip: ZipHandle): string | null => {
    const csvFiles = zip.entries.filter((e) => !e.isDirectory && e.path.toLowerCase().endsWith('.csv'));
    const named = csvFiles.find((e) => basename(e.path).toLowerCase() === 'manifest.csv');
    if (named) return named.path;

    const atRoot = csvFiles.filter((e) => !e.path.includes('/'));
    if (atRoot.length === 1) return (atRoot[0] as { path: string }).path;
    return null;
};

/**
 * Parses the manifest against the zip's real contents and the assessment's
 * students. Nothing is uploaded here — this exists so the admin sees every
 * problem BEFORE a single file leaves their machine.
 */
export const parseManifest = (
    csvText: string,
    zip: ZipHandle,
    students: StudentRow[]
): ParsedManifest => {
    const fatalErrors: string[] = [];

    const parsed = Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: normalizeHeader,
    });

    const headers = (parsed.meta.fields ?? []).map(normalizeHeader);
    const missingRequired = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
    if (missingRequired.length > 0) {
        fatalErrors.push(
            `manifest.csv needs a "${missingRequired.join('", "')}" column — it is how each row is matched to a student.`
        );
    }

    // Not an error, just worth saying: a typo'd header ("marks" instead of
    // "total_marks") would otherwise look like a file that imported fine but
    // silently dropped every score.
    const recognized = new Set<string>(MANIFEST_COLUMNS);
    const unrecognizedHeaders = headers.filter((header) => header && !recognized.has(header));

    // Index the zip once — by full path and by bare file name.
    const filesByPath = new Map<string, string>();
    const filesByName = new Map<string, string[]>();
    for (const entry of zip.entries) {
        if (entry.isDirectory) continue;
        filesByPath.set(entry.path.toLowerCase(), entry.path);
        const name = basename(entry.path).toLowerCase();
        filesByName.set(name, [...(filesByName.get(name) ?? []), entry.path]);
    }

    // Bulk import matches on username, which only the batch-learner listing
    // carries — individually registered participants have no username to match.
    const studentsByUsername = new Map<string, StudentRow>();
    for (const student of students) {
        const key = normalizeKey(student.username);
        if (key) studentsByUsername.set(key, student);
    }

    const seenUsernames = new Map<string, number>();
    const referenced = new Set<string>();

    const rows: ManifestRow[] = (parsed.data ?? []).map((raw, index) => {
        const line = index + 1;
        const errors: string[] = [];

        const username = (raw.username ?? '').trim();
        const student = username ? (studentsByUsername.get(normalizeKey(username)) ?? null) : null;
        if (!username) {
            errors.push('username is blank');
        } else if (!student) {
            errors.push(`no student with username "${username}" in this assessment`);
        }

        const duplicateOf = username ? seenUsernames.get(normalizeKey(username)) : undefined;
        if (duplicateOf !== undefined) {
            errors.push(`duplicate of line ${duplicateOf} — the later row would overwrite the earlier one`);
        } else if (username) {
            seenUsernames.set(normalizeKey(username), line);
        }

        const rawMarks = (raw.total_marks ?? '').trim();
        let totalMarks: number | null = null;
        if (rawMarks) {
            const value = Number(rawMarks);
            if (!Number.isFinite(value) || value < 0) {
                errors.push(`total_marks "${rawMarks}" is not a valid score`);
            } else {
                totalMarks = value;
            }
        }

        const resolveColumn = (column: 'student_pdf' | 'checked_pdf' | 'report_pdf') => {
            const { path, error } = resolveZipPath(raw[column] ?? '', filesByPath, filesByName);
            if (error) errors.push(`${column}: ${error}`);
            if (path) referenced.add(path);
            return path;
        };

        const studentPath = resolveColumn('student_pdf');
        const checkedPath = resolveColumn('checked_pdf');
        const reportPath = resolveColumn('report_pdf');

        if (totalMarks === null && !studentPath && !checkedPath && !reportPath && errors.length === 0) {
            errors.push('nothing to import — set total_marks or at least one file');
        }

        return {
            line,
            username,
            totalMarks,
            studentPath,
            checkedPath,
            reportPath,
            student,
            errors,
        };
    });

    const unreferencedFiles = zip.entries
        .filter(
            (entry) =>
                !entry.isDirectory &&
                !referenced.has(entry.path) &&
                !entry.path.toLowerCase().endsWith('.csv') &&
                basename(entry.path).toLowerCase() !== 'readme.txt'
        )
        .map((entry) => entry.path);

    return {
        rows,
        validRows: fatalErrors.length > 0 ? [] : rows.filter((row) => row.errors.length === 0),
        unreferencedFiles,
        unrecognizedHeaders,
        fatalErrors,
    };
};

/** Turns failures into a CSV the admin can fix and re-upload. */
export const buildErrorCsv = (
    rows: Array<{ line: number; username: string; errors: string[] }>
): string =>
    Papa.unparse({
        fields: ['line', 'username', 'problem'],
        data: rows.map((row) => ({
            line: row.line,
            username: row.username,
            problem: row.errors.join('; '),
        })),
    });
