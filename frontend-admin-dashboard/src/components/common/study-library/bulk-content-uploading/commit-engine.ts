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

import * as pdfjs from 'pdfjs-dist';
import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';
import { convertDocToHtml } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slides-sidebar/utils/doc-to-html';
import { convertPptToPdf } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slides-sidebar/add-ppt-dialog';
import { convertHtmlToPdf } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-helper/helper';
import {
    createDocHtmlSlide,
    createExternalLinkSlide,
    createImageSlide,
    createPdfSlide,
    createVideoFileSlide,
    createYoutubeSlide,
    updateChapterSlideOrder,
    type BulkSlideContext,
} from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-services/bulk-slide-creation';
import { DEFAULT_ENTITY_NAME, isSyntheticRootNode } from './conventions';
import { createChapter, createModule, createSubject } from './hierarchy-api';
import { findExistingChapter } from './matching';
import { openManifest } from './session-manifest';
import { getCurrentZipHandle } from './zip-parser';
import {
    groupItemsByChapter,
    selectSectionsOrdered,
    useBulkContentUploadingStore,
    type SectionDefaults,
} from './use-bulk-content-uploading-store';
import type { BulkItem, BulkNode, BulkUploadContext, ExistingSnapshot } from './types';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const UPLOAD_POOL_SIZE = 3;
const BIG_FILE_BYTES = 100 * 1024 * 1024; // >100MB uploads run one at a time
const UPLOAD_ATTEMPTS = 3;

export interface CommitDeps {
    /** From useReplaceBase64ImagesWithNetworkUrls() — instantiated by the wizard component. */
    replaceBase64ImagesWithNetworkUrls: (html: string) => Promise<string>;
    /** Required in multi-course mode (single mode reads it from the wizard context). */
    instituteId?: string;
}

type Mutex = <T>(task: () => Promise<T>) => Promise<T>;

/** Shared across all scopes in one run: one conversion service, one uplink. */
interface SharedRunResources {
    pptMutex: Mutex;
    bigFileMutex: Mutex;
}

interface CommitScope {
    /** undefined = single mode (all nodes/items are in scope). */
    sectionId?: string;
    context: BulkUploadContext;
    snapshot: ExistingSnapshot;
    getDefaults: () => SectionDefaults;
    setDefaults: (defaults: SectionDefaults) => void;
}

const normalizeHtmlQuotes = (html: string) => html.replace(/\\"/g, '"');

const sortNodes = (nodes: BulkNode[]): BulkNode[] =>
    [...nodes].sort((a, b) => {
        if (a.orderHint !== null || b.orderHint !== null) {
            if (a.orderHint === null) return 1;
            if (b.orderHint === null) return -1;
            if (a.orderHint !== b.orderHint) return a.orderHint - b.orderHint;
        }
        return a.displayName.localeCompare(b.displayName);
    });

/** Serializes calls through a single-flight chain (ppt conversion, big uploads). */
const createMutex = (): Mutex => {
    let chain: Promise<unknown> = Promise.resolve();
    return <T>(task: () => Promise<T>): Promise<T> => {
        const run = chain.then(task, task);
        chain = run.catch(() => undefined);
        return run;
    };
};

const pool = async <T>(
    inputs: T[],
    limit: number,
    task: (input: T, index: number) => Promise<void>
): Promise<void> => {
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, inputs.length) }, async () => {
        while (next < inputs.length) {
            const index = next++;
            await task(inputs[index]!, index);
        }
    });
    await Promise.all(workers);
};

const uploadWithRetry = async (
    file: File,
    instituteId: string,
    sourceId: string
): Promise<string> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
        try {
            // UploadFileInS3 requests a fresh presigned URL on every call, so
            // retries never reuse an expired/consumed URL.
            const fileId = await UploadFileInS3(
                file,
                () => {},
                'bulk-content-upload',
                instituteId,
                sourceId,
                true
            );
            if (!fileId) throw new Error('Upload did not return a file id');
            return fileId;
        } catch (error) {
            lastError = error;
            if (attempt < UPLOAD_ATTEMPTS) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
            }
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Upload failed');
};

const countPdfPages = async (file: File): Promise<number> => {
    try {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buffer }).promise;
        return pdf.numPages;
    } catch {
        return 1; // encrypted/corrupt PDFs still become slides
    }
};

interface PreparedContent {
    fileId?: string;
    totalPages?: number;
    html?: string;
    publicImageUrl?: string;
}

const commitScope = async (
    scope: CommitScope,
    deps: CommitDeps,
    shared: SharedRunResources
): Promise<void> => {
    const store = useBulkContentUploadingStore;
    const state = () => store.getState();
    const { snapshot } = scope;
    const zip = getCurrentZipHandle();

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

    const prepareItem = async (item: BulkItem): Promise<PreparedContent> => {
        if (item.kind === 'YOUTUBE' || item.kind === 'EXTERNAL_LINK') return {};

        state().markItem(item.id, 'preparing');
        if (!zip) throw new Error('The zip file is no longer available — re-select it and retry.');

        if (item.kind === 'DOC') {
            const file = await zip.extractFile(item.entryPath, item.fileName);
            const html = await convertDocToHtml(file);
            const processed = await deps.replaceBase64ImagesWithNetworkUrls(html);
            const normalized = normalizeHtmlQuotes(processed);
            let totalPages = 1;
            try {
                const result = await convertHtmlToPdf(processed);
                totalPages = result.totalPages || 1;
            } catch {
                totalPages = 1;
            }
            return { html: normalized, totalPages };
        }

        if (item.kind === 'PDF' || item.kind === 'PPT') {
            let pdfFile: File;
            if (item.kind === 'PPT') {
                const source = await zip.extractFile(item.entryPath, item.fileName);
                // The conversion service is a shared multipart endpoint — one at a time.
                pdfFile = await shared.pptMutex(() => convertPptToPdf(source));
            } else {
                pdfFile = await zip.extractFile(item.entryPath, item.fileName);
            }
            const totalPages = await countPdfPages(pdfFile);
            if (item.fileId) return { fileId: item.fileId, totalPages };
            state().markItem(item.id, 'uploading');
            const fileId = await uploadWithRetry(pdfFile, instituteId, 'PDF_DOCUMENTS');
            state().patchItem(item.id, { fileId });
            manifest.set(item.key, { fileId });
            return { fileId, totalPages };
        }

        if (item.kind === 'IMAGE') {
            let fileId = item.fileId;
            if (!fileId) {
                const file = await zip.extractFile(item.entryPath, item.fileName);
                state().markItem(item.id, 'uploading');
                fileId = await uploadWithRetry(file, instituteId, 'IMAGES');
                state().patchItem(item.id, { fileId });
                manifest.set(item.key, { fileId });
            }
            const publicImageUrl = await getPublicUrl(fileId);
            if (!publicImageUrl) throw new Error('Could not resolve the uploaded image URL');
            return { fileId, publicImageUrl };
        }

        // VIDEO_FILE
        if (item.fileId) return { fileId: item.fileId };
        const file = await zip.extractFile(item.entryPath, item.fileName);
        state().markItem(item.id, 'uploading');
        const upload = () => uploadWithRetry(file, instituteId, 'ADMIN');
        const fileId =
            item.sizeBytes > BIG_FILE_BYTES ? await shared.bigFileMutex(upload) : await upload();
        state().patchItem(item.id, { fileId });
        manifest.set(item.key, { fileId });
        return { fileId };
    };

    const createSlideForItem = async (
        slideCtx: BulkSlideContext,
        item: BulkItem,
        prepared: PreparedContent,
        slideOrder: number
    ): Promise<string> => {
        switch (item.kind) {
            case 'PDF':
            case 'PPT':
                return createPdfSlide(slideCtx, {
                    title: item.title,
                    fileId: prepared.fileId!,
                    totalPages: prepared.totalPages ?? 1,
                    slideOrder,
                });
            case 'DOC':
                return createDocHtmlSlide(slideCtx, {
                    title: item.title,
                    html: prepared.html!,
                    totalPages: prepared.totalPages ?? 1,
                    slideOrder,
                });
            case 'IMAGE':
                return createImageSlide(slideCtx, {
                    title: item.title,
                    publicImageUrl: prepared.publicImageUrl!,
                    slideOrder,
                });
            case 'VIDEO_FILE':
                return createVideoFileSlide(slideCtx, {
                    title: item.title,
                    fileId: prepared.fileId!,
                    slideOrder,
                });
            case 'YOUTUBE':
                return createYoutubeSlide(slideCtx, {
                    title: item.title,
                    url: item.url!,
                    slideOrder,
                });
            case 'EXTERNAL_LINK':
                return createExternalLinkSlide(slideCtx, {
                    title: item.title,
                    url: item.url!,
                    slideOrder,
                });
        }
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

        // Precomputed orders over the full (non-skipped) list keep numbering
        // deterministic across retries — no max+1 snapshot races.
        const orderedItems = chapterItems.filter((i) => state().items[i.id]?.status !== 'skipped');
        const orderOf = new Map(
            orderedItems.map((item, index) => [item.id, existingSlides.length + index])
        );

        const pendingItems = orderedItems.filter((i) => state().items[i.id]?.status === 'pending');
        if (pendingItems.length === 0) continue;

        const preparedById = new Map<string, Promise<PreparedContent>>();
        const prepareQueue = [...pendingItems];
        const prepareStarted = new Map<string, () => void>();
        // Start preparations through a pool, but expose each as a promise the
        // sequential creator below can await in item order.
        const preparePromises = pendingItems.map(
            (item) =>
                new Promise<PreparedContent>((resolve, reject) => {
                    prepareStarted.set(item.id, () => {
                        prepareItem(item).then(resolve, reject);
                    });
                })
        );
        pendingItems.forEach((item, index) => preparedById.set(item.id, preparePromises[index]!));
        preparedById.forEach((p) => p.catch(() => undefined)); // avoid unhandled rejections
        void pool(prepareQueue, UPLOAD_POOL_SIZE, async (item) => {
            prepareStarted.get(item.id)?.();
            await preparedById.get(item.id)!.catch(() => undefined);
        });

        for (const item of pendingItems) {
            const current = state().items[item.id];
            if (!current || current.status === 'skipped' || current.status === 'done') continue;
            try {
                const prepared = await preparedById.get(item.id)!;
                state().markItem(item.id, 'creating');
                const slideOrder = orderOf.get(item.id) ?? existingSlides.length;
                const slideId = await createSlideForItem(slideCtx, current, prepared, slideOrder);
                state().markItem(item.id, 'done', { slideId });
                manifest.set(item.key, { slideId, fileId: state().items[item.id]?.fileId });
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to create slide';
                state().markItem(item.id, 'failed', { error: message });
            }
        }

        // Pre-existing chapters: append new slides after the existing ones explicitly.
        if (wasExisting && existingSlides.length > 0) {
            const createdNow = orderedItems
                .map((i) => state().items[i.id])
                .filter((i): i is BulkItem => !!i && i.status === 'done' && !!i.slideId);
            if (createdNow.length > 0) {
                const sortedExisting = [...existingSlides].sort(
                    (a, b) => a.slideOrder - b.slideOrder
                );
                const payload = [
                    ...sortedExisting.map((s, index) => ({
                        slide_id: s.id,
                        slide_order: index,
                    })),
                    ...createdNow.map((item, index) => ({
                        slide_id: item.slideId!,
                        slide_order: sortedExisting.length + index,
                    })),
                ];
                try {
                    await updateChapterSlideOrder(slideCtx.chapterId, payload);
                } catch {
                    // Slides exist — only their relative order may be off. Non-fatal.
                }
            }
        }
    }

    manifest.flush();
};

export const runCommit = async (deps: CommitDeps): Promise<void> => {
    const store = useBulkContentUploadingStore;
    const state = () => store.getState();
    const shared: SharedRunResources = { pptMutex: createMutex(), bigFileMutex: createMutex() };

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
