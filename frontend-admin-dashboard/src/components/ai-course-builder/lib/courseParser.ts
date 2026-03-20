/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Subject, Module, Chapter, Slide } from '../course/courseData';

/**
 * Parse the `course_tree` string returned by the backend and convert it to the
 * internal <Subject/Module/Chapter/Slide> structure used by the CourseExplorer
 * and other UI components.
 *
 * The backend returns a JSON string with the following top-level keys:
 *   packageId, packageName, maxDepth, tree (array)
 *
 * The items inside the tree follow the same shape recursively, e.g. each
 * Subject contains `modules`, each Module contains `chapters`, each Chapter
 * contains `slides`.
 *
 * Because the UI only cares about a subset of the attributes we safely pick
 * the fields we need and ignore the rest.
 *
 * @param courseTreeString The raw JSON string coming from the API response
 *                         (usually the value of `course_tree`)
 * @returns An array of Subject objects ready to be consumed by the UI.
 */
export function parseCourseTree(courseTreeInput: unknown): Subject[] {
    if (!courseTreeInput) {
        return [];
    }

    let raw: any;
    try {
        raw = typeof courseTreeInput === 'string' ? JSON.parse(courseTreeInput) : courseTreeInput;
    } catch (err) {
        console.error('[parseCourseTree] Failed to parse courseTreeString', err);
        return [];
    }

    // If the root object contains `tree`, we only care about that array.
    const treeArray: any[] = Array.isArray(raw.tree) ? raw.tree : Array.isArray(raw) ? raw : [];

    const subjects: Subject[] = treeArray.map(parseSubject);
    return subjects;
}

function parseSubject(subjectNode: any): Subject {
    const { id, name, key, depth, path, modules = [] } = subjectNode || {};

    const parsedModules: Module[] = modules.map(parseModule);

    return {
        id: id?.toString() ?? generateId('S'),
        name: name ?? 'Unnamed Subject',
        key,
        depth,
        path,
        modules: parsedModules,
    };
}

function parseModule(moduleNode: any): Module {
    const { id, name, key, depth, path, chapters = [] } = moduleNode || {};
    const parsedChapters: Chapter[] = chapters.map(parseChapter);

    return {
        id: id?.toString() ?? generateId('M'),
        name: name ?? 'Unnamed Module',
        key,
        depth,
        path,
        chapters: parsedChapters,
    };
}

function parseChapter(chapterNode: any): Chapter {
    const { id, name, key, depth, path, slides = [] } = chapterNode || {};
    let parsedSlides: Slide[] = slides.map(parseSlide);

    // Ensure each chapter contains at least one slide of each core type
    parsedSlides = ensureDefaultSlides(parsedSlides, name);

    return {
        id: id?.toString() ?? generateId('C'),
        name: name ?? 'Unnamed Chapter',
        key,
        depth,
        path,
        slides: parsedSlides,
    };
}

function parseSlide(slideNode: any): Slide {
    const { id, name, key, depth, path, type = 'text', content } = slideNode || {};
    // Fallback slide type mapping – backend may send anything, default to 'text'
    const normalizedType = normalizeSlideType(type);
    return {
        id: id?.toString() ?? generateId('SL'),
        name: name ?? 'Unnamed Slide',
        key,
        depth,
        path,
        type: normalizedType,
        content,
    } as Slide;
}

function normalizeSlideType(rawType: string): Slide['type'] {
    const lower = (rawType || '').toLowerCase();
    switch (lower) {
        case 'pdf':
        case 'code':
        case 'html':
        case 'youtube':
        case 'assessment':
        case 'document':
        case 'video':
        case 'text':
            return lower as Slide['type'];
        default:
            return 'text';
    }
}

/**
 * For UX consistency every chapter should expose at least one of each core
 * learning artefact (pdf, video, document, assessment). If the backend has not
 * provided a slide for one or more of these types we create lightweight
 * placeholders so that the UI template still renders them. These placeholders
 * can be populated later by an editor flow.
 */
function ensureDefaultSlides(existing: Slide[], chapterName: string | undefined): Slide[] {
    const safeChapter = chapterName ?? 'Topic';
    const coreTypes: Array<{ type: Slide['type']; label: string }> = [
        { type: 'pdf', label: `${safeChapter} – PDF Guide` },
        { type: 'video', label: `${safeChapter} – Video Lesson` },
        { type: 'document', label: `${safeChapter} – Reference Notes` },
        { type: 'assessment', label: `${safeChapter} – Quiz` },
    ];

    const presentTypes = new Set(existing.map((s) => s.type));

    const slidesWithDefaults: Slide[] = [...existing];

    coreTypes.forEach(({ type, label }) => {
        if (presentTypes.has(type)) return; // already present

        // Try to repurpose an unused generic 'text' slide first
        const textSlideIndex = slidesWithDefaults.findIndex((s) => s.type === 'text');
        if (textSlideIndex !== -1) {
            const existing = slidesWithDefaults[textSlideIndex]!;
            slidesWithDefaults[textSlideIndex] = {
                ...existing,
                id: existing.id ?? generateId(type.toUpperCase()),
                type,
                name: existing.name ?? label,
            } as Slide;
            presentTypes.add(type);
            return;
        }

        // Otherwise create a placeholder slide
        slidesWithDefaults.push({
            id: generateId(type.toUpperCase()),
            name: label,
            type,
        } as Slide);
    });

    return slidesWithDefaults;
}

let idCounter = 0;
function generateId(prefix: string): string {
    idCounter += 1;
    return `${prefix}${idCounter}`;
}
