import type { Subject, Module, Chapter, Slide } from '../course/courseData';

// Types based on AI modifications payload
export interface Modification {
    action: 'ADD' | 'UPDATE' | 'DELETE';
    targetType: 'COURSE' | 'SUBJECT' | 'MODULE' | 'CHAPTER' | 'SLIDE';
    parentPath: string | null;
    node: any; // Raw node coming from AI or manual creation

    // Enhanced fields for rich slide data
    creation_method?: 'AI_GENERATED' | 'MANUALLY_CREATED';
    slide_data?: {
        id: string;
        title: string;
        source_type: string;
        status: string;
        chapter_id?: string;
        chapter_name?: string;
        video_slide?: any;
        document_slide?: any;
        quiz_slide?: any;
        assignment_slide?: any;
        question_slide?: any;
        is_ai_generated?: boolean;
        manual_modifications?: boolean;
    };
}

/**
 * Apply a list of structural modifications (ADD, UPDATE, DELETE) to the existing
 * course data tree immutably and return the new tree.
 */
export function applyModifications(current: Subject[], modifications: Modification[]): Subject[] {
    const updated: Subject[] = JSON.parse(JSON.stringify(current)); // deep clone simple structures

    modifications.forEach((mod) => {
        if (mod.action === 'ADD') {
            handleAddAction(updated, mod);
        } else if (mod.action === 'UPDATE') {
            handleUpdateAction(updated, mod);
        } else if (mod.action === 'DELETE') {
            handleDeleteAction(updated, mod);
        }
    });

    return updated;
}

/**
 * Handle ADD actions for new items
 */
function handleAddAction(updated: Subject[], mod: Modification): void {
    switch (mod.targetType) {
        case 'SUBJECT': {
            const subjectNode = mapSubject(mod.node);
            updated.push(subjectNode);
            break;
        }
        case 'MODULE': {
            if (!mod.parentPath) return;
            const subjectId = getIdFromPath(mod.parentPath, 'S');
            if (!subjectId) return;
            const subjectIndex = updated.findIndex((sub) => sub.id === subjectId);
            if (subjectIndex !== -1 && updated[subjectIndex]) {
                const subject = updated[subjectIndex]!;
                updated[subjectIndex] = {
                    ...subject,
                    id: subject.id || `S-${Date.now()}`,
                    name: subject.name || 'Unnamed Subject',
                    modules: [...(subject.modules || []), mapModule(mod.node)],
                };
            }
            break;
        }
        case 'CHAPTER': {
            if (!mod.parentPath) return;
            const { subjectId, moduleId } = extractSubjectModuleIds(mod.parentPath);
            if (!subjectId || !moduleId) return;
            const subjectIndex = updated.findIndex((sub) => sub.id === subjectId);
            if (subjectIndex !== -1 && updated[subjectIndex]) {
                const subject = updated[subjectIndex]!;
                const moduleIndex = subject.modules.findIndex((mod) => mod.id === moduleId);
                if (moduleIndex !== -1 && subject.modules[moduleIndex]) {
                    const module = subject.modules[moduleIndex]!;
                    subject.modules[moduleIndex] = {
                        ...module,
                        chapters: [...(module.chapters || []), mapChapter(mod.node)],
                    };
                }
            }
            break;
        }
        case 'SLIDE': {
            if (!mod.parentPath) return;
            const ids = extractIds(mod.parentPath);
            const { subjectId, moduleId, chapterId } = ids;
            if (!subjectId || !moduleId || !chapterId) return;
            const subjectIndex = updated.findIndex((sub) => sub.id === subjectId);
            if (subjectIndex !== -1 && updated[subjectIndex]) {
                const subject = updated[subjectIndex]!;
                const moduleIndex = subject.modules.findIndex((mod) => mod.id === moduleId);
                if (moduleIndex !== -1 && subject.modules[moduleIndex]) {
                    const module = subject.modules[moduleIndex]!;
                    const chapterIndex = module.chapters.findIndex((ch) => ch.id === chapterId);
                    if (chapterIndex !== -1 && module.chapters[chapterIndex]) {
                        const chapter = module.chapters[chapterIndex]!;
                        module.chapters[chapterIndex] = {
                            ...chapter,
                            id: chapter.id || `CH-${Date.now()}`,
                            name: chapter.name || 'Unnamed Chapter',
                            slides: [...(chapter.slides || []), mapSlide(mod.node)],
                        };
                    }
                }
            }
            break;
        }
        default:
            break;
    }
}

/**
 * Handle UPDATE actions for existing items
 */
function handleUpdateAction(updated: Subject[], mod: Modification): void {
    if (mod.targetType === 'SLIDE') {
        // Find and update the specific slide by ID
        const slideId = mod.node.id;
        if (!slideId) return;

        for (let i = 0; i < updated.length; i++) {
            const subject = updated[i];
            if (!subject?.modules) continue;

            for (let j = 0; j < subject.modules.length; j++) {
                const module = subject.modules[j];
                if (!module?.chapters) continue;

                for (let k = 0; k < module.chapters.length; k++) {
                    const chapter = module.chapters[k];
                    if (!chapter?.slides) continue;

                    const slideIndex = chapter.slides.findIndex((slide) => slide.id === slideId);
                    if (slideIndex !== -1) {
                        // Update the slide with new data
                        const existingSlide = chapter.slides[slideIndex];
                        if (!existingSlide) continue;

                        const updatedSlide = {
                            ...existingSlide,
                            ...mod.node,
                            // Handle rich slide data specifically
                            ...(mod.slide_data && {
                                title: mod.slide_data.title || existingSlide.title,
                                source_type:
                                    mod.slide_data.source_type || existingSlide.source_type,
                                status: mod.slide_data.status || existingSlide.status,
                                is_ai_generated: mod.slide_data.is_ai_generated,
                                manual_modifications: mod.slide_data.manual_modifications,
                                // Merge rich slide fields
                                video_slide:
                                    mod.slide_data.video_slide || existingSlide.video_slide,
                                document_slide:
                                    mod.slide_data.document_slide || existingSlide.document_slide,
                                quiz_slide: mod.slide_data.quiz_slide || existingSlide.quiz_slide,
                                assignment_slide:
                                    mod.slide_data.assignment_slide ||
                                    existingSlide.assignment_slide,
                                question_slide:
                                    mod.slide_data.question_slide || existingSlide.question_slide,
                            }),
                        };

                        chapter.slides[slideIndex] = updatedSlide;
                        console.log('✅ Updated slide in course data:', {
                            slideId: updatedSlide.id,
                            title: updatedSlide.title,
                            videoUrl: updatedSlide.video_slide?.url,
                            hasVideoSlide: !!updatedSlide.video_slide,
                        });
                        return;
                    }
                }
            }
        }
    }
    // Add support for other targetTypes as needed
}

/**
 * Handle DELETE actions for existing items
 */
function handleDeleteAction(updated: Subject[], mod: Modification): void {
    // TODO: Implement delete functionality as needed
    console.log('DELETE action not yet implemented for:', mod.targetType);
}

/* ---------- Helpers ---------- */
function getIdFromPath(path: string, prefixLetter: string): string | null {
    const parts = path.split('.');
    const match = parts.find((p) => p.startsWith(prefixLetter));
    return match ?? null;
}

function extractSubjectModuleIds(path: string): {
    subjectId: string | null;
    moduleId: string | null;
} {
    const parts = path.split('.');
    const subjectId = parts.find((p) => p.startsWith('S')) ?? null;
    const moduleId = parts.find((p) => p.startsWith('M')) ?? null;
    return { subjectId, moduleId };
}

function extractIds(path: string): {
    subjectId: string | null;
    moduleId: string | null;
    chapterId: string | null;
} {
    const parts = path.split('.');
    const subjectId = parts.find((p) => p.startsWith('S')) ?? null;
    const moduleId = parts.find((p) => p.startsWith('M')) ?? null;
    const chapterId = parts.find((p) => p.startsWith('CH')) ?? null;
    return { subjectId, moduleId, chapterId };
}

function mapSubject(node: any): Subject {
    return {
        id: node.id ?? node.path?.split('.').pop() ?? `S-${Date.now()}`,
        name: node.name || 'Unnamed Subject',
        key: node.key,
        depth: node.depth,
        path: node.path,
        modules: [],
    };
}

function mapModule(node: any): Module {
    return {
        id: node.id ?? node.path?.split('.').pop() ?? `M-${Date.now()}`,
        name: node.name || 'Unnamed Module',
        key: node.key,
        depth: node.depth,
        path: node.path,
        chapters: [],
    };
}

function mapChapter(node: any): Chapter {
    return {
        id: node.id ?? node.path?.split('.').pop() ?? `CH-${Date.now()}`,
        name: node.name || 'Unnamed Chapter',
        key: node.key,
        depth: node.depth,
        path: node.path,
        slides: [],
    };
}

function mapSlide(node: any): Slide {
    return {
        id: node.id ?? node.path?.split('.').pop() ?? `SL-${Date.now()}`,
        name: node.name || 'Unnamed Slide',
        key: node.key,
        depth: node.depth,
        path: node.path,
        type: node.type || 'text',
        content: node.content,
    } as Slide;
}
