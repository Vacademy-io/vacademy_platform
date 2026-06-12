// Bulk Content Uploading — existing-course snapshot + folder↔entity matcher.

import { fetchModulesWithChapters } from '@/routes/study-library/courses/-services/getModulesWithChapters';
import {
    fetchChaptersWithSlides,
    fetchDirectSlides,
    type ChapterWithSlides,
    type Slide,
} from '@/routes/study-library/courses/-services/getAllSlides';
import { getCourseSubjects } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getSubjects';
import type { ModulesWithChapters } from '@/stores/study-library/use-modules-with-chapters-store';
import { DEFAULT_ENTITY_NAME, normalizeName, ROOT_CHAPTER_NODE_ID } from './conventions';
import type {
    BulkItem,
    BulkNode,
    BulkUploadContext,
    ExistingChapter,
    ExistingModule,
    ExistingSlideRef,
    ExistingSnapshot,
    ExistingSubject,
} from './types';

const toSlideRefs = (slides: Slide[] | undefined): ExistingSlideRef[] =>
    (slides ?? [])
        .filter((s) => s.status !== 'DELETED')
        .map((s) => ({ id: s.id, title: s.title, slideOrder: s.slide_order ?? 0 }));

/** Small promise pool — keeps snapshot fetches from bursting the API. */
export const pooled = async <T, R>(
    inputs: T[],
    limit: number,
    task: (input: T) => Promise<R>
): Promise<R[]> => {
    const results: R[] = new Array(inputs.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, inputs.length) }, async () => {
        while (next < inputs.length) {
            const index = next++;
            results[index] = await task(inputs[index]!);
        }
    });
    await Promise.all(workers);
    return results;
};

/**
 * Fetches the course's current structure (subjects → modules → chapters → slides)
 * for matching, collision checks and slide_order bases.
 */
export const buildExistingSnapshot = async (
    context: BulkUploadContext
): Promise<ExistingSnapshot> => {
    const { courseId, sessionId, levelId, packageSessionId, courseDepth } = context;

    const subjects = getCourseSubjects(courseId, sessionId, levelId);

    const subjectsWithModules = await pooled(subjects, 4, async (subject) => {
        const modulesWithChapters: ModulesWithChapters[] = await fetchModulesWithChapters(
            subject.id,
            packageSessionId
        );
        const modules: ExistingModule[] = await pooled(
            modulesWithChapters ?? [],
            4,
            async (moduleEntry) => {
                let chapters: ExistingChapter[] = [];
                try {
                    const chaptersWithSlides: ChapterWithSlides[] = await fetchChaptersWithSlides(
                        moduleEntry.module.id,
                        packageSessionId
                    );
                    chapters = (chaptersWithSlides ?? []).map((cws) => ({
                        id: cws.chapter.id,
                        name: cws.chapter.chapter_name,
                        chapterOrder: cws.chapter.chapter_order ?? 0,
                        slides: toSlideRefs(cws.slides),
                    }));
                } catch {
                    // Fall back to the chapter list without slides (collision check degrades gracefully).
                    chapters = (moduleEntry.chapters ?? []).map((c) => ({
                        id: c.chapter.id,
                        name: c.chapter.chapter_name,
                        chapterOrder: c.chapter.chapter_order ?? 0,
                        slides: [],
                    }));
                }
                return {
                    id: moduleEntry.module.id,
                    name: moduleEntry.module.module_name,
                    chapters,
                };
            }
        );
        return { id: subject.id, name: subject.subject_name, modules } satisfies ExistingSubject;
    });

    const normalizedDefault = normalizeName(DEFAULT_ENTITY_NAME);
    const defaultSubject = subjectsWithModules.find(
        (s) => normalizeName(s.name) === normalizedDefault
    );
    const defaultModule = defaultSubject?.modules.find(
        (m) => normalizeName(m.name) === normalizedDefault
    );
    const defaultChapter = defaultModule?.chapters.find(
        (c) => normalizeName(c.name) === normalizedDefault
    );

    let directSlides: ExistingSlideRef[] = [];
    if (courseDepth === 2) {
        try {
            directSlides = toSlideRefs(await fetchDirectSlides(packageSessionId));
        } catch {
            directSlides = defaultChapter?.slides ?? [];
        }
    }

    return {
        subjects: subjectsWithModules,
        defaults: {
            subjectId: defaultSubject?.id,
            moduleId: defaultModule?.id,
            chapterId: defaultChapter?.id,
        },
        directSlides,
    };
};

interface ScopeEntity {
    id: string;
    name: string;
}

const matchWithinScope = (
    nodesInScope: BulkNode[],
    scopeEntities: ScopeEntity[],
    claimed: Set<string>
) => {
    for (const node of nodesInScope) {
        // Primary pass: prefix-stripped display name; secondary: raw folder name
        // (institutes that keep "01 ..." in their actual chapter names).
        const candidates = [normalizeName(node.displayName), normalizeName(node.rawFolderName)];
        const target = scopeEntities.find(
            (entity) => !claimed.has(entity.id) && candidates.includes(normalizeName(entity.name))
        );
        if (target) {
            claimed.add(target.id);
            node.mapping = { action: 'match', targetId: target.id, targetName: target.name };
        } else {
            node.mapping = { action: 'create' };
        }
    }
};

/**
 * Mutates node.mapping in place: matches folder nodes against the snapshot,
 * scoped by their (matched) parents. Nodes under a "create" parent stay "create".
 */
export const applyMatching = (
    nodes: Record<string, BulkNode>,
    snapshot: ExistingSnapshot,
    courseDepth: number
): void => {
    const allNodes = Object.values(nodes);
    const childrenOf = (parentId: string | null, kind: BulkNode['kind']) =>
        allNodes.filter((n) => n.parentId === parentId && n.kind === kind);

    if (courseDepth === 2) {
        const root = nodes[ROOT_CHAPTER_NODE_ID];
        if (root) {
            root.mapping = snapshot.defaults.chapterId
                ? {
                      action: 'match',
                      targetId: snapshot.defaults.chapterId,
                      targetName: DEFAULT_ENTITY_NAME,
                  }
                : { action: 'create' };
        }
        return;
    }

    const subjectById = new Map(snapshot.subjects.map((s) => [s.id, s]));
    const moduleById = new Map(snapshot.subjects.flatMap((s) => s.modules).map((m) => [m.id, m]));

    if (courseDepth === 5) {
        const subjectNodes = childrenOf(null, 'subject');
        matchWithinScope(subjectNodes, snapshot.subjects, new Set());
        for (const subjectNode of subjectNodes) {
            const subject = subjectNode.mapping.targetId
                ? subjectById.get(subjectNode.mapping.targetId)
                : undefined;
            const moduleNodes = childrenOf(subjectNode.id, 'module');
            matchWithinScope(moduleNodes, subject?.modules ?? [], new Set());
            for (const moduleNode of moduleNodes) {
                const moduleEntity = moduleNode.mapping.targetId
                    ? moduleById.get(moduleNode.mapping.targetId)
                    : undefined;
                matchWithinScope(
                    childrenOf(moduleNode.id, 'chapter'),
                    moduleEntity?.chapters ?? [],
                    new Set()
                );
            }
        }
        return;
    }

    if (courseDepth === 4) {
        const defaultSubject = snapshot.defaults.subjectId
            ? subjectById.get(snapshot.defaults.subjectId)
            : undefined;
        const moduleNodes = childrenOf(null, 'module');
        matchWithinScope(moduleNodes, defaultSubject?.modules ?? [], new Set());
        for (const moduleNode of moduleNodes) {
            const moduleEntity = moduleNode.mapping.targetId
                ? moduleById.get(moduleNode.mapping.targetId)
                : undefined;
            matchWithinScope(
                childrenOf(moduleNode.id, 'chapter'),
                moduleEntity?.chapters ?? [],
                new Set()
            );
        }
        return;
    }

    // courseDepth === 3 — top-level folders are chapters under the DEFAULT module.
    const defaultModule = snapshot.defaults.moduleId
        ? moduleById.get(snapshot.defaults.moduleId)
        : undefined;
    matchWithinScope(childrenOf(null, 'chapter'), defaultModule?.chapters ?? [], new Set());
};

/**
 * Existing entities a node could be remapped onto (same level, within its
 * matched parent). Used by the preview tree's remap dropdown.
 */
export const scopeEntitiesForNode = (
    node: BulkNode,
    nodes: Record<string, BulkNode>,
    snapshot: ExistingSnapshot,
    courseDepth: number
): ScopeEntity[] => {
    const subjectById = new Map(snapshot.subjects.map((s) => [s.id, s]));
    const moduleById = new Map(snapshot.subjects.flatMap((s) => s.modules).map((m) => [m.id, m]));
    const parent = node.parentId ? nodes[node.parentId] : undefined;

    if (node.kind === 'subject') return snapshot.subjects;

    if (node.kind === 'module') {
        const subjectId =
            courseDepth === 4 ? snapshot.defaults.subjectId : parent?.mapping.targetId;
        return subjectId ? subjectById.get(subjectId)?.modules ?? [] : [];
    }

    // chapter
    const moduleId =
        courseDepth === 3
            ? snapshot.defaults.moduleId
            : parent?.mapping.action === 'match'
              ? parent.mapping.targetId
              : undefined;
    return moduleId ? moduleById.get(moduleId)?.chapters ?? [] : [];
};

export const findExistingChapter = (
    snapshot: ExistingSnapshot,
    chapterId: string
): ExistingChapter | undefined => {
    for (const subject of snapshot.subjects) {
        for (const moduleEntity of subject.modules) {
            const chapter = moduleEntity.chapters.find((c) => c.id === chapterId);
            if (chapter) return chapter;
        }
    }
    return undefined;
};

export const COLLISION_WARNING = 'A slide with this title already exists in the target chapter.';

/** Existing slide titles (normalized) of the chapter a node currently maps to. */
export const existingTitlesForChapterNode = (
    chapterNode: BulkNode,
    snapshot: ExistingSnapshot,
    courseDepth: number
): Set<string> | null => {
    if (courseDepth === 2) {
        return new Set(snapshot.directSlides.map((s) => normalizeName(s.title)));
    }
    if (chapterNode.mapping.action === 'match' && chapterNode.mapping.targetId) {
        const chapter = findExistingChapter(snapshot, chapterNode.mapping.targetId);
        if (chapter) return new Set(chapter.slides.map((s) => normalizeName(s.title)));
    }
    return null;
};

/**
 * Flags items whose title already exists in the target chapter. Mutates
 * item.warnings; the commit engine separately honors options.skipDuplicateTitles.
 */
export const annotateSlideCollisions = (
    items: Record<string, BulkItem>,
    nodes: Record<string, BulkNode>,
    snapshot: ExistingSnapshot,
    courseDepth: number
): void => {
    for (const item of Object.values(items)) {
        const chapterNode = nodes[item.chapterNodeId];
        if (!chapterNode) continue;
        const existingTitles = existingTitlesForChapterNode(chapterNode, snapshot, courseDepth);
        if (existingTitles?.has(normalizeName(item.title))) {
            const warning = COLLISION_WARNING;
            if (!item.warnings.includes(warning)) item.warnings.push(warning);
        }
    }
};
