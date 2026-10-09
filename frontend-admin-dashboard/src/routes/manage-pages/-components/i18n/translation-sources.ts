/**
 * Live data a site shows but does not store — course names, folder titles,
 * product page names, level names. The learner site translates these at
 * DISPLAY time through the same dictionary (useSiteT), keyed by the exact text
 * it displays, so the strings collected here must be byte-identical to what
 * the renderers show.
 */
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { OPEN_CATALOGUE_COURSE_SEARCH_V2 } from '@/constants/urls';
import {
    getFolderTree,
    listFolderLibraries,
    type FolderNode,
} from '../../-services/folder-library-service';
import { getAllProductPages } from '../../product-pages/-services/product-pages-service';

export type LiveTextGroup =
    | 'Course name'
    | 'Course description'
    | 'Level'
    | 'Folder'
    | 'Product page';

export interface LiveText {
    source: string;
    group: LiveTextGroup;
}

/** Libraries read per site at most (each is one request). */
const MAX_LIBRARIES = 20;

/** Live values are free text (a course called "physics" is still copy); only blanks, links and pure numbers are skipped. */
export const isLiveText = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    const t = value.trim();
    if (!t) return false;
    if (/^(https?:|mailto:|tel:|\/\/|www\.)/i.test(t)) return false;
    return !/^[\d\s.,:;%+\-–—/×x*₹$€£¥()]+$/.test(t);
};

/** The course card's description: the HTML description as plain text (same transform as the learner card). */
export const courseCardDescription = (html: unknown): string =>
    typeof html === 'string'
        ? html
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .trim()
        : '';

/** Distinct texts, first occurrence wins (its group is the one shown). */
export const dedupeLiveTexts = (items: LiveText[]): LiveText[] => {
    const seen = new Set<string>();
    const out: LiveText[] = [];
    for (const item of items) {
        if (!isLiveText(item.source) || seen.has(item.source)) continue;
        seen.add(item.source);
        out.push(item);
    }
    return out;
};

interface CourseSearchRow {
    package_name?: string | null;
    level_name?: string | null;
    course_html_description_html?: string | null;
}

/** Backend placeholder level names the learner never shows. */
const SENTINEL_LEVEL_NAMES = new Set(['default', 'none', 'null', 'undefined', '']);

/**
 * A level name as the Courses page shows it: the learner's displayLevelName
 * (CourseCatalogComponent) — placeholders hidden, the rest title-cased by
 * lib/utils toTitleCase ('class_10' → 'Class 10', 'Pre-Foundation' →
 * 'Pre Foundation', acronyms kept). Copied on purpose: the dictionary is
 * keyed by the exact text shown, so keep the two in step.
 */
export const displayedLevelName = (raw: string | null | undefined): string => {
    const trimmed = (raw || '').trim();
    if (SENTINEL_LEVEL_NAMES.has(trimmed.toLowerCase())) return '';
    return trimmed
        .split(/[\s_-]+/)
        .map((word) =>
            word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase()
                ? word
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(' ');
};

/** Course rows → texts (names, card descriptions, level names). */
export const courseTextsFromRows = (rows: CourseSearchRow[]): LiveText[] => {
    const names: LiveText[] = [];
    const descriptions: LiveText[] = [];
    const levels: LiveText[] = [];
    for (const row of rows || []) {
        if (row?.package_name) names.push({ source: row.package_name, group: 'Course name' });
        const description = courseCardDescription(row?.course_html_description_html);
        if (description) descriptions.push({ source: description, group: 'Course description' });
        if (row?.level_name) {
            // As stored (the course page and learning paths show it so) and
            // as the Courses page cards and level filter show it.
            levels.push({ source: row.level_name, group: 'Level' });
            const shown = displayedLevelName(row.level_name);
            if (shown) levels.push({ source: shown, group: 'Level' });
        }
    }
    return dedupeLiveTexts([...names, ...levels, ...descriptions]);
};

/** The same request the live catalogue makes (all catalogue courses, one page). */
export const fetchCourseTexts = async (instituteId: string): Promise<LiveText[]> => {
    const response = await authenticatedAxiosInstance.post<
        { content?: CourseSearchRow[] } | CourseSearchRow[]
    >(
        OPEN_CATALOGUE_COURSE_SEARCH_V2,
        {
            status: [],
            level_ids: [],
            faculty_ids: [],
            search_by_name: '',
            tag: [],
            min_percentage_completed: 0,
            max_percentage_completed: 0,
        },
        { params: { instituteId, page: 0, size: 1000, sort: 'createdAt,desc' } }
    );
    const data = response.data;
    const rows = Array.isArray(data) ? data : data?.content ?? [];
    return courseTextsFromRows(rows);
};

/** Folder fields a visitor reads: title, subtitle, tagline, description, call-to-action. */
export const folderTextsFromNodes = (roots: FolderNode[]): LiveText[] => {
    const out: LiveText[] = [];
    const walk = (nodes: FolderNode[]) => {
        for (const n of nodes || []) {
            if (n.status === 'HIDDEN') continue;
            for (const value of [n.title, n.subtitle, n.tagline, n.description, n.cta_label]) {
                if (value) out.push({ source: value, group: 'Folder' });
            }
            walk(n.children || []);
        }
    };
    walk(roots);
    return dedupeLiveTexts(out);
};

export const fetchFolderTexts = async (instituteId: string): Promise<LiveText[]> => {
    const libraries = (await listFolderLibraries(instituteId)).slice(0, MAX_LIBRARIES);
    const trees = await Promise.all(libraries.map((l) => getFolderTree(instituteId, l.id)));
    return dedupeLiveTexts(trees.flatMap((tree) => folderTextsFromNodes(tree.roots || [])));
};

export const fetchProductPageTexts = async (instituteId: string): Promise<LiveText[]> => {
    const pages = await getAllProductPages(instituteId);
    return dedupeLiveTexts(
        pages
            .filter((p) => (p.status || '').toUpperCase() !== 'DELETED')
            .map((p) => ({ source: p.name, group: 'Product page' as const }))
    );
};
