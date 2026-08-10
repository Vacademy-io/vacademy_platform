import type {
    OfflineManifestDTO,
    OfflineManifestSlideDTO,
    OfflineSourceType,
    OfflineSubtreeWarning,
} from '@/types/offline-access';

/** Every slide in the manifest, flattened. */
function allSlides(manifest: OfflineManifestDTO): OfflineManifestSlideDTO[] {
    return manifest.subjects.flatMap((s) =>
        s.modules.flatMap((m) => m.chapters.flatMap((c) => c.slides))
    );
}

/** Slides under a specific node (by source type + id), for the §7.4 warning + effective-state summary. */
export function slidesUnderNode(
    manifest: OfflineManifestDTO,
    sourceType: OfflineSourceType,
    sourceId: string
): OfflineManifestSlideDTO[] {
    switch (sourceType) {
        case 'PACKAGE':
        case 'PACKAGE_SESSION':
            return allSlides(manifest);
        case 'SUBJECT':
            return manifest.subjects
                .filter((s) => s.subject_id === sourceId)
                .flatMap((s) => s.modules.flatMap((m) => m.chapters.flatMap((c) => c.slides)));
        case 'MODULE':
            return manifest.subjects
                .flatMap((s) => s.modules)
                .filter((m) => m.module_id === sourceId)
                .flatMap((m) => m.chapters.flatMap((c) => c.slides));
        case 'CHAPTER':
            return manifest.subjects
                .flatMap((s) => s.modules)
                .flatMap((m) => m.chapters)
                .filter((c) => c.chapter_id === sourceId)
                .flatMap((c) => c.slides);
        case 'SLIDE':
            return allSlides(manifest).filter((sl) => sl.slide_id === sourceId);
        default:
            return [];
    }
}

/** §7.4 warning: how many items under this node are streamed/interactive and can never be downloaded. */
export function computeOnlineOnlyWarning(
    manifest: OfflineManifestDTO | null,
    sourceType: OfflineSourceType,
    sourceId: string
): OfflineSubtreeWarning | null {
    if (!manifest) return null;
    const slides = slidesUnderNode(manifest, sourceType, sourceId);
    const onlineOnlyCount = slides.filter((s) => s.reason === 'ONLINE_ONLY').length;
    return { totalSlides: slides.length, onlineOnlyCount };
}
