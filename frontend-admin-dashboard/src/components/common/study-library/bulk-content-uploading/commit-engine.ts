// Bulk Content Uploading — commit orchestrator.
//
// commitScope() runs the full v1 pipeline for ONE course+batch scope:
//   Phase 0: resolve/create the hidden DEFAULT chain for course_depth < 5.
//   Phase 1: create missing subjects/modules/chapters (sequential — small N, order matters).
//   Phase 2: per chapter — extract/convert/upload files through a small pool, then
//            create slides sequentially with precomputed slide_order (no order races).
// runCommit() executes one scope (single mode) or one scope per ready course
// section, sequentially (multi mode). A section failure blocks only that
// section's items; the loop continues.
//
// Plain async functions, not hooks: they read/write the zustand store via
// getState() so progress renders live regardless of which step is mounted.

import type { BulkSlideContext } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-services/bulk-slide-creation';
import { DEFAULT_ENTITY_NAME, isSyntheticRootNode } from './conventions';
import { createChapter, createModule, createSubject } from './hierarchy-api';
import { findExistingChapter } from './matching';
import { openManifest } from './session-manifest';
import { getCurrentZipHandle } from './zip-parser';
import { extractDirectFile, hasDirectFiles } from './file-source';
import {
    commitChapterItems,
    createMutex,
    reorderAppendedSlides,
    reorderChapterSlidesExplicit,
    type PipelineCtx,
    type SharedRunResources,
} from './slide-pipeline';
import {
    groupItemsByChapter,
    selectSectionsOrdered,
    useBulkContentUploadingStore,
    type SectionDefaults,
} from './use-bulk-content-uploading-store';
import type { BulkItem, BulkNode, BulkUploadContext, ExistingSnapshot } from './types';

export interface CommitDeps {
    /** From useReplaceBase64ImagesWithNetworkUrls() — instantiated by the wizard component. */
    replaceBase64ImagesWithNetworkUrls: (html: string) => Promise<string>;
    /** Required in multi-course mode (single mode reads it from the wizard context). */
    instituteId?: string;
}

interface CommitScope {
    /** undefined = single mode (all nodes/items are in scope). */
    sectionId?: string;
    context: BulkUploadContext;
    snapshot: ExistingSnapshot;
    getDefaults: () => SectionDefaults;
    setDefaults: (defaults: SectionDefaults) => void;
}

/** Pick the file source for this run: in-memory selection (CSV direct mode) or the zip. */
const buildExtractFile = (): PipelineCtx['extractFile'] => {
    if (hasDirectFiles()) return extractDirectFile;
    const zip = getCurrentZipHandle();
    if (zip) return (entryPath, fileName) => zip.extractFile(entryPath, fileName);
    return () =>
        Promise.reject(new Error('The upload is no longer available — re-select it and retry.'));
};

const sortNodes = (nodes: BulkNode[]): BulkNode[] =>
    [...nodes].sort((a, b) => {
        if (a.orderHint !== null || b.orderHint !== null) {
            if (a.orderHint === null) return 1;
            if (b.orderHint === null) return -1;
            if (a.orderHint !== b.orderHint) return a.orderHint - b.orderHint;
        }
        return a.displayName.localeCompare(b.displayName);
    });

const commitScope = async (
    scope: CommitScope,
    deps: CommitDeps,
    shared: SharedRunResources
): Promise<void> => {
    const store = useBulkContentUploadingStore;
    const state = () => store.getState();
    const { snapshot } = scope;

    const { packageSessionId, instituteId, courseDepth } = scope.context;
    const options = state().options;

    const inScope = (entity: { sectionId?: string }) =>
        scope.sectionId ? entity.sectionId === scope.sectionId : true;
    const scopedItems = () => Object.values(state().items).filter(inScope);
    const scopedNodes = () => Object.values(state().nodes).filter(inScope);

    const manifestContextKey = `${scope.context.courseId}|${packageSessionId}`;
    const manifest = openManifest(manifestContextKey, state().fingerprint);

    // Pre-pass: restore completed work from a previous interrupted run + apply skip rules.
    for (const item of scopedItems()) {
        const remembered = manifest.get(item.key);
        if (remembered?.fileId && !item.fileId) {
            state().patchItem(item.id, { fileId: remembered.fileId });
        }
        if (remembered?.slideId && item.status !== 'done') {
            state().markItem(item.id, 'done', { slideId: remembered.slideId });
            continue;
        }
        if (item.status === 'done' || item.status === 'skipped') continue;
        // Skip-duplicates only applies when the target chapter actually pre-exists.
        // A chapter being created in this run has no slides yet — any collision
        // warning on its items is stale (e.g. it was remapped to "Create new").
        const itemChapter = state().nodes[item.chapterNodeId];
        const chapterPreExists = courseDepth === 2 || itemChapter?.mapping.action === 'match';
        if (
            options.skipDuplicateTitles &&
            chapterPreExists &&
            item.warnings.some((w) => w.includes('already exists'))
        ) {
            state().markItem(item.id, 'skipped');
            continue;
        }
        // failed/blocked items from a previous run become retryable
        state().markItem(item.id, 'pending', { error: undefined });
    }

    // ----- Phase 0: DEFAULT chain for hidden levels (depth < 5) -----
    const defaults = { ...snapshot.defaults, ...scope.getDefaults() };
    try {
        if (courseDepth < 5 && !defaults.subjectId) {
            defaults.subjectId = await createSubject(DEFAULT_ENTITY_NAME, packageSessionId);
        }
        if (courseDepth < 4 && !defaults.moduleId) {
            defaults.moduleId = await createModule(
                DEFAULT_ENTITY_NAME,
                defaults.subjectId!,
                packageSessionId
            );
        }
        if (courseDepth < 3 && !defaults.chapterId) {
            defaults.chapterId = await createChapter(
                DEFAULT_ENTITY_NAME,
                0,
                defaults.subjectId!,
                defaults.moduleId!,
                packageSessionId
            );
        }
    } catch (error) {
        // Without the default chain nothing in this scope can be created.
        const message =
            error instanceof Error ? error.message : 'Could not prepare the course structure';
        for (const item of scopedItems()) {
            if (item.status === 'pending') {
                state().markItem(item.id, 'blocked', { error: message });
            }
        }
        manifest.flush();
        return;
    }
    scope.setDefaults(defaults);

    // ----- Phase 1: hierarchy (sequential) -----
    const nodesByParent = (parentId: string | null, kind: BulkNode['kind']) =>
        sortNodes(scopedNodes().filter((n) => n.parentId === parentId && n.kind === kind));

    const chapterNodeIdsUnder = (node: BulkNode): string[] => {
        if (node.kind === 'chapter') return [node.id];
        return scopedNodes()
            .filter((n) => n.parentId === node.id)
            .flatMap((n) => chapterNodeIdsUnder(n));
    };

    const skippedOrFailedNode = (node: BulkNode, reason: string, failed: boolean) => {
        state().markNode(node.id, failed ? 'failed' : 'done', failed ? { error: reason } : {});
        const chapterIds = chapterNodeIdsUnder(node);
        for (const item of scopedItems()) {
            if (chapterIds.includes(item.chapterNodeId) && item.status === 'pending') {
                state().markItem(item.id, failed ? 'blocked' : 'skipped', {
                    error: failed ? reason : undefined,
                });
            }
        }
    };

    // Match-only: bulk upload never creates subjects/modules/chapters. Folders
    // without an existing match (action 'create') are skipped — the UI gates
    // Confirm on these, so this path is a defensive fallback only.
    const resolveNode = (node: BulkNode, kindLabel: string): boolean => {
        if (node.resolvedId) return true;
        if (node.mapping.action === 'skip') {
            skippedOrFailedNode(node, 'Skipped by you', false);
            return false;
        }
        if (node.mapping.action === 'match' && node.mapping.targetId) {
            state().markNode(node.id, 'done', { resolvedId: node.mapping.targetId });
            return true;
        }
        skippedOrFailedNode(node, `No matching ${kindLabel} — folder skipped`, false);
        return false;
    };

    const resolveChapterNodes = (parentNodeId: string | null) => {
        for (const chapterNode of nodesByParent(parentNodeId, 'chapter')) {
            resolveNode(chapterNode, 'chapter');
        }
    };

    const resolveModuleNodes = (parentNodeId: string | null) => {
        for (const moduleNode of nodesByParent(parentNodeId, 'module')) {
            if (!resolveNode(moduleNode, 'module')) continue;
            resolveChapterNodes(moduleNode.id);
        }
    };

    if (courseDepth === 5) {
        for (const subjectNode of nodesByParent(null, 'subject')) {
            if (!resolveNode(subjectNode, 'subject')) continue;
            resolveModuleNodes(subjectNode.id);
        }
    } else if (courseDepth === 4) {
        resolveModuleNodes(null);
    } else if (courseDepth === 3) {
        resolveChapterNodes(null);
    } else {
        const root = scopedNodes().find(isSyntheticRootNode);
        if (root) state().markNode(root.id, 'done', { resolvedId: defaults.chapterId });
    }

    // ----- Phase 2: slides, chapter by chapter -----

    /** Resolved subject/module ids for a chapter node (for slide query params). */
    const slideContextFor = (chapterNode: BulkNode): BulkSlideContext | null => {
        if (!chapterNode.resolvedId) return null;
        let subjectId = defaults.subjectId ?? '';
        let moduleId = defaults.moduleId ?? '';
        if (courseDepth >= 4) {
            const moduleNode = chapterNode.parentId
                ? state().nodes[chapterNode.parentId]
                : undefined;
            moduleId = moduleNode?.resolvedId ?? moduleId;
            if (courseDepth === 5) {
                const subjectNode = moduleNode?.parentId
                    ? state().nodes[moduleNode.parentId]
                    : undefined;
                subjectId = subjectNode?.resolvedId ?? subjectId;
            }
        }
        if (!subjectId || !moduleId) return null;
        return {
            chapterId: chapterNode.resolvedId,
            moduleId,
            subjectId,
            packageSessionId,
            instituteId,
            status: options.publish ? 'PUBLISHED' : 'DRAFT',
            notify: options.notify,
        };
    };

    const pipeline: PipelineCtx = {
        extractFile: buildExtractFile(),
        instituteId,
        manifest,
        shared,
        replaceBase64ImagesWithNetworkUrls: deps.replaceBase64ImagesWithNetworkUrls,
        markItem: (id, status, patch) => state().markItem(id, status, patch),
        patchItem: (id, patch) => state().patchItem(id, patch),
    };

    const allChapterNodes = scopedNodes().filter((n) => n.kind === 'chapter' && n.resolvedId);
    const itemsByChapter = groupItemsByChapter(state().items);

    for (const chapterNode of allChapterNodes) {
        const slideCtx = slideContextFor(state().nodes[chapterNode.id] ?? chapterNode);
        const chapterItems = itemsByChapter.get(chapterNode.id) ?? [];
        if (!slideCtx || chapterItems.length === 0) continue;

        const wasExisting = chapterNode.mapping.action === 'match';
        const existingChapter =
            wasExisting && chapterNode.mapping.targetId
                ? findExistingChapter(snapshot, chapterNode.mapping.targetId)
                : undefined;
        const existingSlides =
            courseDepth === 2 ? snapshot.directSlides : existingChapter?.slides ?? [];

        await commitChapterItems({
            chapterItems,
            slideCtx,
            existingSlideCount: existingSlides.length,
            pipeline,
            getItem: (id) => state().items[id],
        });

        // Pre-existing chapters: append new slides after the existing ones explicitly.
        if (wasExisting && existingSlides.length > 0) {
            const createdIds = chapterItems
                .map((i) => state().items[i.id])
                .filter((i): i is BulkItem => !!i && i.status === 'done' && !!i.slideId)
                .map((i) => i.slideId!);
            await reorderAppendedSlides(slideCtx.chapterId, existingSlides, createdIds);
        }
    }

    manifest.flush();
};

/**
 * CSV-manifest commit: chapters already exist and are given by id (no hierarchy
 * creation). One scope per package session; per chapter, prepare+create via the
 * shared pipeline, sourcing the slide-order base directly from the chapter index
 * (no courseDepth coupling). Section failure blocks only that section's items.
 */
const runCsvCommit = async (deps: CommitDeps, shared: SharedRunResources): Promise<void> => {
    const store = useBulkContentUploadingStore;
    const state = () => store.getState();
    const extractFile = buildExtractFile();
    const instituteId = deps.instituteId || state().context?.instituteId || '';
    const fingerprint = state().fingerprint;

    state().setPhase('committing');

    for (const section of selectSectionsOrdered(state().courseSections)) {
        if (section.status !== 'ready' || !section.courseId || !section.packageSessionId) continue;
        const chapterIndex = state().chapterIndexBySection[section.id];
        if (!chapterIndex || !instituteId) continue;

        const manifest = openManifest(
            `${section.courseId}|${section.packageSessionId}`,
            fingerprint
        );
        const pipeline: PipelineCtx = {
            extractFile,
            instituteId,
            manifest,
            shared,
            replaceBase64ImagesWithNetworkUrls: deps.replaceBase64ImagesWithNetworkUrls,
            markItem: (id, status, patch) => state().markItem(id, status, patch),
            patchItem: (id, patch) => state().patchItem(id, patch),
        };
        const options = state().options;

        // Resume pre-pass: restore completed work from a prior interrupted run.
        for (const item of Object.values(state().items)) {
            if (item.sectionId !== section.id) continue;
            const remembered = manifest.get(item.key);
            if (remembered?.fileId && !item.fileId) {
                state().patchItem(item.id, { fileId: remembered.fileId });
            }
            if (remembered?.slideId && item.status !== 'done') {
                state().markItem(item.id, 'done', { slideId: remembered.slideId });
                continue;
            }
            if (item.status === 'done' || item.status === 'skipped') continue;
            state().markItem(item.id, 'pending', { error: undefined });
        }

        const itemsByChapter = groupItemsByChapter(state().items);
        const chapterNodes = Object.values(state().nodes).filter(
            (n) => n.sectionId === section.id && n.kind === 'chapter' && n.resolvedId
        );

        for (const chapterNode of chapterNodes) {
            const resolution = chapterIndex[chapterNode.resolvedId!];
            const chapterItems = itemsByChapter.get(chapterNode.id) ?? [];
            if (!resolution || chapterItems.length === 0) continue;

            const slideCtx: BulkSlideContext = {
                chapterId: resolution.chapterId,
                moduleId: resolution.moduleId,
                subjectId: resolution.subjectId,
                packageSessionId: section.packageSessionId,
                instituteId,
                status: options.publish ? 'PUBLISHED' : 'DRAFT',
                notify: options.notify,
            };

            try {
                // Split by per-row placement: top slides go before the chapter's
                // existing slides, bottom (default) after. Create top-first.
                const topItems = chapterItems.filter(
                    (i) => state().items[i.id]?.placement === 'top'
                );
                const bottomItems = chapterItems.filter(
                    (i) => state().items[i.id]?.placement !== 'top'
                );
                await commitChapterItems({
                    chapterItems: [...topItems, ...bottomItems],
                    slideCtx,
                    existingSlideCount: resolution.existingSlides.length,
                    pipeline,
                    getItem: (id) => state().items[id],
                });
                const createdId = (item: BulkItem): string | undefined => {
                    const current = state().items[item.id];
                    return current?.status === 'done' && current.slideId
                        ? current.slideId
                        : undefined;
                };
                const topCreated = topItems.map(createdId).filter((x): x is string => !!x);
                const bottomCreated = bottomItems.map(createdId).filter((x): x is string => !!x);
                // Reorder only when placement matters: existing slides present, or
                // some slides must sit at the top. Pure bottom-append to an empty
                // chapter is already in creation order.
                if (
                    topCreated.length + bottomCreated.length > 0 &&
                    (resolution.existingSlides.length > 0 || topCreated.length > 0)
                ) {
                    const existingIds = [...resolution.existingSlides]
                        .sort((a, b) => a.slideOrder - b.slideOrder)
                        .map((s) => s.id);
                    await reorderChapterSlidesExplicit(resolution.chapterId, [
                        ...topCreated,
                        ...existingIds,
                        ...bottomCreated,
                    ]);
                }
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : 'Failed to upload this chapter';
                for (const item of chapterItems) {
                    if (state().items[item.id]?.status === 'pending') {
                        state().markItem(item.id, 'blocked', { error: message });
                    }
                }
            }
        }
        manifest.flush();
    }

    state().setPhase('results');
};

export const runCommit = async (deps: CommitDeps): Promise<void> => {
    const store = useBulkContentUploadingStore;
    const state = () => store.getState();
    const shared: SharedRunResources = { pptMutex: createMutex(), bigFileMutex: createMutex() };

    if (state().mode === 'csv') {
        await runCsvCommit(deps, shared);
        return;
    }

    if (state().mode === 'single') {
        const context = state().context;
        const snapshot = state().existingSnapshot;
        if (!context || !snapshot) throw new Error('Bulk upload context is not initialized');
        state().setPhase('committing');
        await commitScope(
            {
                context,
                snapshot,
                getDefaults: () => state().defaults,
                setDefaults: (defaults) => state().setDefaults(defaults),
            },
            deps,
            shared
        );
        state().setPhase('results');
        return;
    }

    // Multi-course: one scope per ready section, sequential.
    state().setPhase('committing');
    for (const section of selectSectionsOrdered(state().courseSections)) {
        if (section.status !== 'ready') continue;
        const snapshot = state().sectionSnapshots[section.id];
        if (
            !snapshot ||
            !section.courseId ||
            !section.sessionId ||
            !section.levelId ||
            !section.packageSessionId
        ) {
            continue;
        }
        const instituteId = deps.instituteId || state().context?.instituteId || '';
        if (!instituteId) continue;
        const context: BulkUploadContext = {
            courseId: section.courseId,
            sessionId: section.sessionId,
            levelId: section.levelId,
            packageSessionId: section.packageSessionId,
            courseDepth: section.courseDepth ?? 5,
            instituteId,
        };
        try {
            await commitScope(
                {
                    sectionId: section.id,
                    context,
                    snapshot,
                    getDefaults: () => state().sectionDefaults[section.id] ?? {},
                    setDefaults: (defaults) => state().setSectionDefaults(section.id, defaults),
                },
                deps,
                shared
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Upload failed for this course';
            for (const item of Object.values(state().items)) {
                if (item.sectionId === section.id && item.status === 'pending') {
                    state().markItem(item.id, 'blocked', { error: message });
                }
            }
        }
    }
    state().setPhase('results');
};
