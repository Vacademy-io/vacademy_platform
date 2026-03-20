/* eslint-disable @typescript-eslint/no-explicit-any, complexity */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { courseData as defaultCourseData } from './courseData';
import type { Subject, Module, Chapter, Slide } from './courseData';
import { TreeItem } from './TreeItem';
import { SearchIcon } from '../common/icons/icons';
import './styles/CourseExplorer.css';
import './styles/ai-slide-dropdown-fix.css';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    createPresentationSlidePayload,
    createDocumentSlidePayload,
    createPdfSlidePayload,
    createVideoSlidePayload,
    createQuizSlidePayload,
    createAssignmentSlidePayload,
    createQuestionSlidePayload,
    createJupyterNotebookSlidePayload,
    createScratchProjectSlidePayload,
    createCodeEditorSlidePayload,
    convertAISlideToRichSlide,
} from '../lib/slidePayloads';
import type { Slide as RichSlide } from '../types/index';
import { Modification } from '../lib/applyModifications';
import { AISlideDropdown } from './components/AISlideDropdown';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface SelectedItem {
    type: 'course' | 'subject' | 'module' | 'chapter' | 'slide';
    id: string;
    data: Subject | Module | Chapter | Slide;
}

interface CourseExplorerProps {
    selectedItem?: SelectedItem | null;
    onItemSelect?: (item: SelectedItem | null) => void;
    data?: Subject[]; // optional prop for external course data
    setData?: React.Dispatch<React.SetStateAction<Subject[]>>; // optional setter from parent
    onModifications?: (modifications: Modification[]) => void; // callback for modification tracking
    incomingModifications?: Modification[]; // for real-time animation triggers
}

// Helper function to get style classes for slide types
const getSlideTypeStyle = (type: string): string => {
    const styleMap: Record<string, string> = {
        pdf: 'bg-red-100 text-red-700 hover:bg-red-200',
        video: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
        document: 'bg-green-100 text-green-700 hover:bg-green-200',
        assessment: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
        quiz: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
        presentation: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
        assignment: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
        question: 'bg-pink-100 text-pink-700 hover:bg-pink-200',
    };
    return styleMap[type] || 'bg-gray-100 text-gray-700 hover:bg-gray-200';
};

const CourseExplorer: React.FC<CourseExplorerProps> = ({
    selectedItem: externalSelectedItem,
    onItemSelect,
    data,
    setData,
    onModifications,
    incomingModifications,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [internalSelectedItem, setInternalSelectedItem] = useState<SelectedItem | null>(null);
    const [expandAll, setExpandAll] = useState(true);
    const [expandSignal, setExpandSignal] = useState(0);

    // Real-time animation and highlighting state
    const [newlyAddedItems, setNewlyAddedItems] = useState<Set<string>>(new Set());
    const [animatingItems, setAnimatingItems] = useState<Set<string>>(new Set());

    // Maintain a local state copy so we can mutate (add items)
    const [courseDataState, setCourseDataState] = useState<Subject[]>(data ?? defaultCourseData);

    // Helper to update either local state or call parent setter (must be declared before effects)
    const updateCourseData = useCallback(
        (updater: (prev: Subject[]) => Subject[]) => {
            if (setData) {
                setData(updater);
            } else {
                setCourseDataState(updater);
            }
        },
        [setData]
    );

    /* ------------------------------------------------------------------
     Dynamic slide creation via CustomEvent – same as ui-course-builder
     Components (e.g., TodoList) dispatch:
       window.dispatchEvent(new CustomEvent('create-slide', { detail: { path, name, content, slideType } }));
  ------------------------------------------------------------------ */

    interface CreateSlideEventDetail {
        path: string; // e.g. C1.M1.CH1.SL1
        name: string; // slide title
        slideType?: Slide['type']; // defaults to 'document'
        content?: string; // optional markdown/html
    }

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<CreateSlideEventDetail>).detail;
            if (!detail || !detail.path) return;

            updateCourseData((prev) => {
                const updated = [...prev];

                const [courseSegRaw, subjectSegRaw, moduleSegRaw, chapterSegRaw, slideSegRaw] =
                    detail.path.split('.');

                // Ensure we work with defined strings to satisfy TypeScript
                const courseSeg = courseSegRaw || 'C0';
                const subjectSeg = subjectSegRaw || 'S0';
                const moduleSeg = moduleSegRaw || 'M0';
                const chapterSeg = chapterSegRaw || 'CH0';
                const slideSeg = slideSegRaw || 'SL0';

                const toTitle = (seg: string): string => {
                    const match = seg.match(/^([A-Z]+)(\d+)$/i);
                    if (!match) return seg;
                    const prefix = match[1]!.toUpperCase();
                    const num = match[2];
                    switch (prefix) {
                        case 'C':
                            return `${getTerminology(ContentTerms.Course, SystemTerms.Course)} ${num}`;
                        case 'S':
                            return `${getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)} ${num}`;
                        case 'M':
                            return `${getTerminology(ContentTerms.Modules, SystemTerms.Modules)} ${num}`;
                        case 'CH':
                            return `${getTerminology(ContentTerms.Chapters, SystemTerms.Chapters)} ${num}`;
                        default:
                            return seg;
                    }
                };

                // ----- Ensure subject layer -----
                let subject = updated.find((s) => s.path?.endsWith(subjectSeg));
                if (!subject) {
                    subject = {
                        id: `${subjectSeg}-${Date.now()}`,
                        name: toTitle(subjectSeg),
                        path: `${courseSeg}.${subjectSeg}`,
                        modules: [],
                    } as Subject;
                    updated.push(subject);
                }

                // ----- Ensure module layer -----
                let module = subject.modules.find((m) => m.path?.endsWith(moduleSeg));
                if (!module) {
                    module = {
                        id: `${moduleSeg}-${Date.now()}`,
                        name: toTitle(moduleSeg),
                        path: `${courseSeg}.${subjectSeg}.${moduleSeg}`,
                        chapters: [],
                    } as Module;
                    subject.modules.push(module);
                }

                // ----- Ensure chapter layer -----
                let chapter = module.chapters.find((c) => c.path?.endsWith(chapterSeg));
                if (!chapter) {
                    chapter = {
                        id: `${chapterSeg}-${Date.now()}`,
                        name: toTitle(chapterSeg),
                        path: `${courseSeg}.${subjectSeg}.${moduleSeg}.${chapterSeg}`,
                        slides: [],
                    } as Chapter;
                    module.chapters.push(chapter);
                }

                // ----- Ensure / update slide layer -----
                let slide = chapter.slides.find((s) => s.path?.endsWith(slideSeg));
                if (!slide) {
                    // Create a rich slide using the conversion function for AI-generated content
                    const aiSlideData = {
                        name: detail.name,
                        type: detail.slideType ?? 'document',
                        content: detail.content,
                    };

                    // Convert to rich slide format to ensure proper UI treatment
                    const richSlide = convertAISlideToRichSlide(aiSlideData, chapter.name);

                    // Create the course data slide with rich properties
                    slide = {
                        id: richSlide.id,
                        name: detail.name,
                        title: richSlide.title,
                        path: detail.path,
                        type: detail.slideType ?? 'document',
                        source_type: richSlide.source_type,
                        content: detail.content,
                        status: richSlide.status,
                        slide_order: richSlide.slide_order,
                        is_ai_generated: true, // Mark as AI-generated
                    } as Slide;
                    chapter.slides.push(slide);
                } else {
                    slide.name = detail.name;
                    slide.title = detail.name;
                    slide.content = detail.content ?? slide.content;
                    slide.type = detail.slideType ?? slide.type;
                    slide.is_ai_generated = true; // Mark existing slide as AI-modified
                }

                return updated;
            });
        };

        window.addEventListener('create-slide', handler as EventListener);
        return () => window.removeEventListener('create-slide', handler as EventListener);
    }, [updateCourseData]);

    // Keep local state in sync when parent passes new data
    useEffect(() => {
        if (data) {
            setCourseDataState(data);
        }
    }, [data]);

    // Track new items for highlighting and animation
    const handleNewItemAdded = useCallback((itemPath: string) => {
        setNewlyAddedItems((prev) => new Set([...prev, itemPath]));
        setAnimatingItems((prev) => new Set([...prev, itemPath]));

        // Remove highlighting after animation
        setTimeout(() => {
            setAnimatingItems((prev) => {
                const next = new Set(prev);
                next.delete(itemPath);
                return next;
            });
        }, 1000);

        // Remove from newly added after longer delay
        setTimeout(() => {
            setNewlyAddedItems((prev) => {
                const next = new Set(prev);
                next.delete(itemPath);
                return next;
            });
        }, 3000);
    }, []);

    // Listen for incoming modifications and trigger animations
    useEffect(() => {
        if (incomingModifications && incomingModifications.length > 0) {
            incomingModifications.forEach((mod) => {
                if (mod.action === 'ADD' && mod.node?.path) {
                    handleNewItemAdded(mod.node.path);
                    console.log('🎬 Triggering animation for new item:', mod.node.path);
                }
            });
        }
    }, [incomingModifications, handleNewItemAdded]);

    const selectedItem = externalSelectedItem || internalSelectedItem;

    const courseStats = useMemo(() => {
        let totalSlides = 0;
        let totalModules = 0;
        let totalChapters = 0;

        courseDataState.forEach((subject) => {
            totalModules += subject.modules.length;
            subject.modules.forEach((module) => {
                totalChapters += module.chapters.length;
                module.chapters.forEach((chapter) => {
                    totalSlides += chapter.slides.length;
                });
            });
        });

        return { totalSlides, totalModules, totalChapters };
    }, [courseDataState]);

    const filteredData = useMemo(() => {
        if (!searchTerm.trim()) return courseDataState;

        const searchLower = searchTerm.toLowerCase();

        return courseDataState
            .map((subject) => {
                const filteredModules = subject.modules
                    .map((module) => {
                        const filteredChapters = module.chapters
                            .map((chapter) => {
                                const filteredSlides = chapter.slides.filter(
                                    (slide) =>
                                        slide.name.toLowerCase().includes(searchLower) ||
                                        slide.type.toLowerCase().includes(searchLower)
                                );

                                if (
                                    filteredSlides.length > 0 ||
                                    chapter.name.toLowerCase().includes(searchLower)
                                ) {
                                    return { ...chapter, slides: filteredSlides };
                                }
                                return null;
                            })
                            .filter(Boolean) as Chapter[];

                        if (
                            filteredChapters.length > 0 ||
                            module.name.toLowerCase().includes(searchLower)
                        ) {
                            return { ...module, chapters: filteredChapters };
                        }
                        return null;
                    })
                    .filter(Boolean) as Module[];

                if (
                    filteredModules.length > 0 ||
                    subject.name.toLowerCase().includes(searchLower)
                ) {
                    return { ...subject, modules: filteredModules };
                }
                return null;
            })
            .filter(Boolean) as Subject[];
    }, [searchTerm, courseDataState]);

    /* ---------- Add Item Helpers ---------- */
    const genId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const addModule = (subjectId: string, name: string) => {
        updateCourseData((prev) =>
            prev.map((sub) => {
                if (sub.id !== subjectId) return sub;
                const newModule: Module = {
                    id: genId('mod'),
                    name,
                    chapters: [],
                };
                return { ...sub, modules: [...sub.modules, newModule] };
            })
        );
    };

    const addChapter = (moduleId: string, name: string) => {
        updateCourseData((prev) =>
            prev.map((sub) => ({
                ...sub,
                modules: sub.modules.map((mod) => {
                    if (mod.id !== moduleId) return mod;
                    const newChapter: Chapter = {
                        id: genId('chap'),
                        name,
                        slides: [],
                    };
                    return { ...mod, chapters: [...mod.chapters, newChapter] };
                }),
            }))
        );
    };

    // Insert a new slide with rich structure and track modifications
    const addSlide = (
        chapterId: string,
        name: string,
        type:
            | 'pdf'
            | 'text'
            | 'video'
            | 'assessment'
            | 'presentation'
            | 'quiz'
            | 'assignment'
            | 'question'
            | 'document'
            | 'jupyter-notebook'
            | 'scratch-project'
            | 'code-editor' = 'text'
    ) => {
        updateCourseData((prev) =>
            prev.map((sub) => ({
                ...sub,
                modules: sub.modules.map((mod) => ({
                    ...mod,
                    chapters: mod.chapters.map((chap) => {
                        if (chap.id !== chapterId) return chap;

                        // Find chapter name for slide creation
                        const chapterName = chap.name;
                        const existingSlides = chap.slides;

                        // Create rich slide payload based on type
                        let richSlidePayload: RichSlide;
                        switch (type) {
                            case 'presentation':
                                richSlidePayload = createPresentationSlidePayload(
                                    chapterName,
                                    existingSlides as unknown as RichSlide[],
                                    name
                                );
                                break;
                            case 'pdf':
                                richSlidePayload = createPdfSlidePayload(
                                    chapterName,
                                    existingSlides as unknown as RichSlide[],
                                    name
                                );
                                break;
                            case 'video':
                                richSlidePayload = createVideoSlidePayload(
                                    chapterName,
                                    existingSlides as unknown as RichSlide[],
                                    name
                                );
                                break;
                            case 'quiz':
                            case 'assessment':
                                richSlidePayload = createQuizSlidePayload(
                                    chapterName,
                                    existingSlides as unknown as RichSlide[],
                                    name
                                );
                                break;
                            case 'assignment':
                                richSlidePayload = createAssignmentSlidePayload(
                                    chapterName,
                                    existingSlides as unknown as RichSlide[],
                                    name
                                );
                                break;
                            case 'question':
                                richSlidePayload = createQuestionSlidePayload(
                                    chapterName,
                                    existingSlides as unknown as RichSlide[],
                                    name
                                );
                                break;
                            case 'jupyter-notebook':
                                richSlidePayload = createJupyterNotebookSlidePayload(
                                    chapterName,
                                    existingSlides as unknown as RichSlide[],
                                    name
                                );
                                break;
                            case 'scratch-project':
                                richSlidePayload = createScratchProjectSlidePayload(
                                    chapterName,
                                    existingSlides as unknown as RichSlide[],
                                    name
                                );
                                break;
                            case 'code-editor':
                                richSlidePayload = createCodeEditorSlidePayload(
                                    chapterName,
                                    existingSlides as unknown as RichSlide[],
                                    name
                                );
                                break;
                            case 'document':
                            case 'text':
                            default:
                                richSlidePayload = createDocumentSlidePayload(
                                    chapterName,
                                    existingSlides as unknown as RichSlide[],
                                    name
                                );
                                break;
                        }

                        // Convert to simple slide for CourseExplorer compatibility
                        const newSlide: Slide = {
                            id: richSlidePayload.id,
                            name: richSlidePayload.title,
                            title: richSlidePayload.title,
                            type:
                                type === 'jupyter-notebook' ||
                                type === 'scratch-project' ||
                                type === 'code-editor' ||
                                type === 'question'
                                    ? 'text'
                                    : (type as any),
                            source_type: richSlidePayload.source_type,
                            status: richSlidePayload.status,
                            slide_order: richSlidePayload.slide_order,
                            is_ai_generated: false,
                        };

                        // Create modification for tracking
                        const modification: Modification = {
                            action: 'ADD',
                            targetType: 'SLIDE',
                            parentPath: `${chap.id}`,
                            node: {
                                ...richSlidePayload,
                                creation_method: 'MANUALLY_CREATED',
                                chapter_id: chapterId,
                                chapter_name: chapterName,
                            },
                        };

                        // Notify parent about modification
                        if (onModifications) {
                            onModifications([modification]);
                        }

                        // Determine insertion position
                        let newSlides: Slide[];
                        if (type === 'video') {
                            const lastVideoIdx = [...chap.slides]
                                .map((s) => s.type)
                                .lastIndexOf('video');
                            if (lastVideoIdx === -1) {
                                // No existing videos – append to end
                                newSlides = [...chap.slides, newSlide];
                            } else {
                                // Insert after last video slide
                                newSlides = [
                                    ...chap.slides.slice(0, lastVideoIdx + 1),
                                    newSlide,
                                    ...chap.slides.slice(lastVideoIdx + 1),
                                ];
                            }
                        } else {
                            newSlides = [...chap.slides, newSlide];
                        }

                        return { ...chap, slides: newSlides };
                    }),
                })),
            }))
        );
    };

    /* ---------- Delete Helpers ---------- */
    const deleteModule = (moduleId: string) => {
        updateCourseData((prev) =>
            prev.map((sub) => ({
                ...sub,
                modules: sub.modules.filter((m) => m.id !== moduleId),
            }))
        );
    };

    const deleteChapter = (chapterId: string) => {
        updateCourseData((prev) =>
            prev.map((sub) => ({
                ...sub,
                modules: sub.modules.map((m) => ({
                    ...m,
                    chapters: m.chapters.filter((ch) => ch.id !== chapterId),
                })),
            }))
        );
    };

    // Add dialog preset for specific slide type within a chapter
    const openAddSlideForType = (
        chapterId: string,
        type:
            | 'pdf'
            | 'video'
            | 'document'
            | 'assessment'
            | 'presentation'
            | 'quiz'
            | 'assignment'
            | 'question'
    ) => {
        setDialogMode('add');
        setDialogTarget('slide');
        setDialogParentId(chapterId);
        setDialogName('');
        setDialogSlideType(type);
        setAllowedSlideTypes([type]);
        setDialogOpen(true);
    };

    // Delete all slides of given type inside chapter
    const deleteSlidesByType = (chapterId: string, type: string) => {
        updateCourseData((prev) =>
            prev.map((sub) => ({
                ...sub,
                modules: sub.modules.map((mod) => ({
                    ...mod,
                    chapters: mod.chapters.map((chap) => {
                        if (chap.id !== chapterId) return chap;
                        return {
                            ...chap,
                            slides: chap.slides.filter((s) => s.type !== type),
                        };
                    }),
                })),
            }))
        );
    };

    const openDeleteSlidesByType = (chapterId: string, type: string) => {
        setDialogMode('delete');
        setDialogTarget('slideGroup');
        setDialogSlideType(type as any);
        setDialogChapterIdForGroup(chapterId);
        setDialogOpen(true);
    };

    /* ---------- Dialog State ---------- */
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'add' | 'delete'>('add');
    const [dialogTarget, setDialogTarget] = useState<'module' | 'chapter' | 'slide' | 'slideGroup'>(
        'module'
    );
    const [dialogParentId, setDialogParentId] = useState<string>('');
    const [dialogTargetId, setDialogTargetId] = useState<string>('');
    const [dialogName, setDialogName] = useState<string>('');
    const [dialogSlideType, setDialogSlideType] = useState<
        | ''
        | 'pdf'
        | 'video'
        | 'document'
        | 'assessment'
        | 'presentation'
        | 'quiz'
        | 'assignment'
        | 'question'
        | 'jupyter-notebook'
        | 'scratch-project'
        | 'code-editor'
    >('');
    const allSlideTypes = [
        'pdf',
        'video',
        'document',
        'assessment',
        'presentation',
        'quiz',
        'assignment',
        'question',
        'jupyter-notebook',
        'scratch-project',
        'code-editor',
    ] as const;
    const [allowedSlideTypes, setAllowedSlideTypes] = useState<(typeof allSlideTypes)[number][]>([
        ...allSlideTypes,
    ]);
    const [dialogChapterIdForGroup, setDialogChapterIdForGroup] = useState<string>('');

    const openAddDialog = (target: 'module' | 'chapter' | 'slide', parentId: string) => {
        setDialogMode('add');
        setDialogTarget(target);
        setDialogParentId(parentId);
        setDialogName('');
        if (target === 'slide') {
            setDialogSlideType('');
            setAllowedSlideTypes([...allSlideTypes]);
        }
        setDialogOpen(true);
    };

    // New handler for slide dropdown selection that bypasses the dialog
    const handleSlideTypeSelection = (chapterId: string, type: string, name: string) => {
        addSlide(chapterId, name, type as any);
    };

    // Helper function to get slide type styling for dialog
    const getSlideTypeStyle = (type: string) => {
        const styles: Record<string, string> = {
            pdf: 'bg-red-100 text-red-700',
            video: 'bg-green-100 text-green-700',
            document: 'bg-blue-100 text-blue-700',
            presentation: 'bg-orange-100 text-orange-700',
            quiz: 'bg-purple-100 text-purple-700',
            assignment: 'bg-indigo-100 text-indigo-700',
            question: 'bg-yellow-100 text-yellow-700',
            'jupyter-notebook': 'bg-violet-100 text-violet-700',
            'scratch-project': 'bg-amber-100 text-amber-700',
            'code-editor': 'bg-emerald-100 text-emerald-700',
        };
        return styles[type] || 'bg-gray-100 text-gray-700';
    };

    const openDeleteDialog = (target: 'module' | 'chapter', targetId: string) => {
        setDialogMode('delete');
        setDialogTarget(target);
        setDialogTargetId(targetId);
        setDialogOpen(true);
    };

    const handleDialogConfirm = () => {
        if (dialogMode === 'add') {
            if (!dialogName.trim()) return;
            if (dialogTarget === 'module') addModule(dialogParentId, dialogName.trim());
            else if (dialogTarget === 'chapter') addChapter(dialogParentId, dialogName.trim());
            else if (dialogTarget === 'slide')
                addSlide(dialogParentId, dialogName.trim(), dialogSlideType as any);
        } else {
            // delete
            if (dialogTarget === 'module') deleteModule(dialogTargetId);
            else if (dialogTarget === 'chapter') deleteChapter(dialogTargetId);
            else if (dialogTarget === 'slideGroup')
                deleteSlidesByType(dialogChapterIdForGroup, dialogSlideType);
        }
        setDialogOpen(false);
    };

    const handleItemSelect = (type: SelectedItem['type'], id: string, data: any) => {
        const item = { type, id, data };
        setInternalSelectedItem(item);
        onItemSelect?.(item);
    };

    const getSlideCount = (chapters: Chapter[]) => {
        return chapters.reduce((total, chapter) => total + chapter.slides.length, 0);
    };

    const getCompletedSlides = (chapters: Chapter[]) => {
        return Math.floor(getSlideCount(chapters) * 0.7);
    };

    const renderEmpty = () => (
        <div className="course-explorer-empty">
            <div className="course-explorer-empty-icon">
                <SearchIcon />
            </div>
            <p className="course-explorer-empty-text">{searchTerm ? 'No results' : 'No content'}</p>
        </div>
    );

    const formatStats = () => {
        const { totalModules, totalChapters, totalSlides } = courseStats;
        return `${totalModules}M·${totalChapters}C·${totalSlides}S`;
    };

    if (filteredData.length === 0) {
        return (
            <div className="course-explorer">
                <div className="course-explorer-header">
                    <div className="course-explorer-header-content">
                        <h3 className="course-explorer-title">Content</h3>
                        <p className="course-explorer-subtitle">Explorer</p>
                    </div>
                    <button className="expand-toggle-btn" onClick={() => setExpandAll(!expandAll)}>
                        {expandAll ? '−' : '+'}
                    </button>
                </div>

                <div className="course-explorer-search">
                    <div className="search-input-wrapper">
                        <div className="search-icon">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>

                <div className="course-explorer-content">{renderEmpty()}</div>
            </div>
        );
    }

    return (
        <div className="course-explorer">
            <div className="course-explorer-header">
                <div className="course-explorer-header-content">
                    <h3 className="course-explorer-title">Content</h3>
                    <p className="course-explorer-subtitle">{formatStats()}</p>
                </div>
                <button
                    className="expand-toggle-btn"
                    onClick={() => {
                        setExpandAll(!expandAll);
                        setExpandSignal((s) => s + 1);
                    }}
                >
                    {expandAll ? '−' : '+'}
                </button>
            </div>

            <div className="course-explorer-search">
                <div className="search-input-wrapper">
                    <div className="search-icon">
                        <SearchIcon />
                    </div>
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            <div className="course-explorer-content">
                {(() => {
                    if (filteredData.length === 0) return null;

                    // --- Build 5-level hierarchy: COURSE > SUBJECT > MODULE ...

                    // 1. Determine course name from first path segment or fallback
                    const firstSubjectPath = filteredData[0]!.path ?? 'C1.S1';
                    const courseSeg = firstSubjectPath.split('.')[0] || 'C0'; // e.g., C1
                    const courseName = `Course ${courseSeg.replace(/^C/i, '')}`;

                    // Stats across all subjects
                    const courseSlideCount = getSlideCount(
                        filteredData.flatMap((s) => s.modules).flatMap((m) => m.chapters)
                    );
                    const courseCompleted = getCompletedSlides(
                        filteredData.flatMap((s) => s.modules).flatMap((m) => m.chapters)
                    );

                    return (
                        <TreeItem
                            key={courseSeg}
                            label={courseName}
                            isFolder
                            level={0}
                            itemType="course"
                            slideCount={courseSlideCount}
                            completedSlides={courseCompleted}
                            isSelected={
                                selectedItem?.type === 'course' && selectedItem.id === courseSeg
                            }
                            onSelect={() =>
                                handleItemSelect('subject', courseSeg || 'C0', {
                                    name: courseName,
                                    modules: filteredData,
                                } as any)
                            }
                            expandAll={expandAll}
                            expandSignal={expandSignal}
                            isNewlyAdded={newlyAddedItems.has(courseSeg)}
                            isAnimating={animatingItems.has(courseSeg)}
                            itemPath={courseSeg}
                        >
                            {filteredData.map((subject: Subject) => {
                                const aggregatedModules = subject.modules;
                                const subjectSlideCount = getSlideCount(
                                    aggregatedModules.flatMap((m) => m.chapters)
                                );
                                const subjectCompleted = getCompletedSlides(
                                    aggregatedModules.flatMap((m) => m.chapters)
                                );

                                return (
                                    <TreeItem
                                        key={subject.id}
                                        label={subject.name}
                                        isFolder
                                        level={1}
                                        itemType="subject"
                                        slideCount={subjectSlideCount}
                                        completedSlides={subjectCompleted}
                                        isSelected={
                                            selectedItem?.type === 'subject' &&
                                            selectedItem.id === subject.id
                                        }
                                        onSelect={() =>
                                            handleItemSelect('subject', subject.id, subject)
                                        }
                                        expandAll={expandAll}
                                        expandSignal={expandSignal}
                                        onAdd={() => openAddDialog('module', subject.id)}
                                        isNewlyAdded={newlyAddedItems.has(
                                            subject.path || subject.id
                                        )}
                                        isAnimating={animatingItems.has(subject.path || subject.id)}
                                        itemPath={subject.path || subject.id}
                                    >
                                        {aggregatedModules.map((module: Module) => {
                                            const slideCount = getSlideCount(module.chapters);
                                            const completedSlides = getCompletedSlides(
                                                module.chapters
                                            );
                                            return (
                                                <TreeItem
                                                    key={module.id}
                                                    label={module.name}
                                                    isFolder
                                                    level={2}
                                                    itemType="module"
                                                    slideCount={slideCount}
                                                    completedSlides={completedSlides}
                                                    isSelected={
                                                        selectedItem?.type === 'module' &&
                                                        selectedItem.id === module.id
                                                    }
                                                    onSelect={() =>
                                                        handleItemSelect(
                                                            'module',
                                                            module.id,
                                                            module
                                                        )
                                                    }
                                                    expandAll={expandAll}
                                                    expandSignal={expandSignal}
                                                    onAdd={() =>
                                                        openAddDialog('chapter', module.id)
                                                    }
                                                    onDelete={() =>
                                                        openDeleteDialog('module', module.id)
                                                    }
                                                    isNewlyAdded={newlyAddedItems.has(
                                                        module.path || module.id
                                                    )}
                                                    isAnimating={animatingItems.has(
                                                        module.path || module.id
                                                    )}
                                                    itemPath={module.path || module.id}
                                                >
                                                    {module.chapters.map((chapter: Chapter) => {
                                                        const chapterSlideCount =
                                                            chapter.slides.length;
                                                        return (
                                                            <TreeItem
                                                                key={chapter.id}
                                                                label={chapter.name}
                                                                isFolder
                                                                level={3}
                                                                itemType="chapter"
                                                                slideCount={chapterSlideCount}
                                                                isSelected={
                                                                    selectedItem?.type ===
                                                                        'chapter' &&
                                                                    selectedItem.id === chapter.id
                                                                }
                                                                onSelect={() =>
                                                                    handleItemSelect(
                                                                        'chapter',
                                                                        chapter.id,
                                                                        chapter
                                                                    )
                                                                }
                                                                expandAll={expandAll}
                                                                expandSignal={expandSignal}
                                                                customAddButton={
                                                                    <AISlideDropdown
                                                                        onSlideTypeSelect={(
                                                                            type,
                                                                            name
                                                                        ) =>
                                                                            handleSlideTypeSelection(
                                                                                chapter.id,
                                                                                type,
                                                                                name || 'New Slide'
                                                                            )
                                                                        }
                                                                    />
                                                                }
                                                                onDelete={() =>
                                                                    openDeleteDialog(
                                                                        'chapter',
                                                                        chapter.id
                                                                    )
                                                                }
                                                                isNewlyAdded={newlyAddedItems.has(
                                                                    chapter.path || chapter.id
                                                                )}
                                                                isAnimating={animatingItems.has(
                                                                    chapter.path || chapter.id
                                                                )}
                                                                itemPath={
                                                                    chapter.path || chapter.id
                                                                }
                                                            >
                                                                {(() => {
                                                                    // Group slides by type and render in priority order
                                                                    const slidesByType: Record<
                                                                        string,
                                                                        Slide[]
                                                                    > = {};
                                                                    chapter.slides.forEach((s) => {
                                                                        if (!slidesByType[s.type])
                                                                            slidesByType[s.type] =
                                                                                [];
                                                                        slidesByType[s.type]!.push(
                                                                            s
                                                                        );
                                                                    });

                                                                    const typePriority = [
                                                                        'pdf',
                                                                        'video',
                                                                        'document',
                                                                        'assessment',
                                                                    ];
                                                                    const sortedTypes = [
                                                                        ...typePriority,
                                                                        ...Object.keys(
                                                                            slidesByType
                                                                        ).filter(
                                                                            (t) =>
                                                                                !typePriority.includes(
                                                                                    t
                                                                                )
                                                                        ),
                                                                    ];

                                                                    const typeLabels: Record<
                                                                        string,
                                                                        string
                                                                    > = {
                                                                        video: 'Videos',
                                                                        document: 'Documents',
                                                                        pdf: 'PDFs',
                                                                        assessment: 'Assessments',
                                                                    };

                                                                    const elements: React.ReactNode[] =
                                                                        [];

                                                                    sortedTypes.forEach((t) => {
                                                                        const slides =
                                                                            slidesByType[t];
                                                                        if (!slides) return;

                                                                        if (slides.length > 1) {
                                                                            elements.push(
                                                                                <TreeItem
                                                                                    key={`${chapter.id}-${t}-group`}
                                                                                    label={
                                                                                        typeLabels[
                                                                                            t
                                                                                        ] ??
                                                                                        t
                                                                                            .charAt(
                                                                                                0
                                                                                            )
                                                                                            .toUpperCase() +
                                                                                            t.slice(
                                                                                                1
                                                                                            ) +
                                                                                            's'
                                                                                    }
                                                                                    isFolder
                                                                                    level={4}
                                                                                    itemType={
                                                                                        `${t}Group` as any
                                                                                    }
                                                                                    expandAll={
                                                                                        expandAll
                                                                                    }
                                                                                    expandSignal={
                                                                                        expandSignal
                                                                                    }
                                                                                    onAdd={() =>
                                                                                        openAddSlideForType(
                                                                                            chapter.id,
                                                                                            t as any
                                                                                        )
                                                                                    }
                                                                                    onDelete={() =>
                                                                                        openDeleteSlidesByType(
                                                                                            chapter.id,
                                                                                            t
                                                                                        )
                                                                                    }
                                                                                    isNewlyAdded={newlyAddedItems.has(
                                                                                        `${chapter.path || chapter.id}-${t}-group`
                                                                                    )}
                                                                                    isAnimating={animatingItems.has(
                                                                                        `${chapter.path || chapter.id}-${t}-group`
                                                                                    )}
                                                                                    itemPath={`${chapter.path || chapter.id}-${t}-group`}
                                                                                >
                                                                                    {slides
                                                                                        .filter(
                                                                                            (
                                                                                                s
                                                                                            ): s is Slide =>
                                                                                                Boolean(
                                                                                                    s
                                                                                                )
                                                                                        )
                                                                                        .map(
                                                                                            (
                                                                                                sl
                                                                                            ) => (
                                                                                                <TreeItem
                                                                                                    key={
                                                                                                        sl.id
                                                                                                    }
                                                                                                    label={
                                                                                                        sl.name
                                                                                                    }
                                                                                                    level={
                                                                                                        5
                                                                                                    }
                                                                                                    slide={
                                                                                                        sl
                                                                                                    }
                                                                                                    itemType="slide"
                                                                                                    isSelected={
                                                                                                        selectedItem?.type ===
                                                                                                            'slide' &&
                                                                                                        selectedItem.id ===
                                                                                                            sl.id
                                                                                                    }
                                                                                                    onSelect={() =>
                                                                                                        handleItemSelect(
                                                                                                            'slide',
                                                                                                            sl.id,
                                                                                                            sl
                                                                                                        )
                                                                                                    }
                                                                                                    expandAll={
                                                                                                        expandAll
                                                                                                    }
                                                                                                    expandSignal={
                                                                                                        expandSignal
                                                                                                    }
                                                                                                    onAdd={() => {}}
                                                                                                    isNewlyAdded={newlyAddedItems.has(
                                                                                                        sl.path ||
                                                                                                            sl.id
                                                                                                    )}
                                                                                                    isAnimating={animatingItems.has(
                                                                                                        sl.path ||
                                                                                                            sl.id
                                                                                                    )}
                                                                                                    itemPath={
                                                                                                        sl.path ||
                                                                                                        sl.id
                                                                                                    }
                                                                                                />
                                                                                            )
                                                                                        )}
                                                                                </TreeItem>
                                                                            );
                                                                        } else {
                                                                            const sl = slides[0];
                                                                            elements.push(
                                                                                <TreeItem
                                                                                    key={sl!.id}
                                                                                    label={sl!.name}
                                                                                    level={4}
                                                                                    slide={sl!}
                                                                                    itemType="slide"
                                                                                    isSelected={
                                                                                        selectedItem?.type ===
                                                                                            'slide' &&
                                                                                        selectedItem.id ===
                                                                                            sl!.id
                                                                                    }
                                                                                    onSelect={() =>
                                                                                        handleItemSelect(
                                                                                            'slide',
                                                                                            sl!.id,
                                                                                            sl
                                                                                        )
                                                                                    }
                                                                                    expandAll={
                                                                                        expandAll
                                                                                    }
                                                                                    expandSignal={
                                                                                        expandSignal
                                                                                    }
                                                                                    onAdd={() => {}}
                                                                                />
                                                                            );
                                                                        }
                                                                    });

                                                                    return elements;
                                                                })()}
                                                            </TreeItem>
                                                        );
                                                    })}
                                                </TreeItem>
                                            );
                                        })}
                                    </TreeItem>
                                );
                            })}
                        </TreeItem>
                    );
                })()}
            </div>

            {/* Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="space-y-3 p-4 text-sm">
                    <DialogHeader>
                        <DialogTitle>
                            {dialogMode === 'add'
                                ? dialogTarget === 'slide'
                                    ? 'Add Slide'
                                    : `Add ${dialogTarget}`
                                : dialogTarget === 'slideGroup'
                                  ? `Delete all ${dialogSlideType}s`
                                  : `Delete ${dialogTarget}`}
                        </DialogTitle>
                        {dialogMode === 'delete' && (
                            <DialogDescription>
                                {dialogTarget === 'slideGroup'
                                    ? `This will remove all ${dialogSlideType} slides from the chapter.`
                                    : `Are you sure you want to delete this ${dialogTarget}?`}
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {dialogMode === 'add' && (
                        <div className="space-y-2">
                            <div>
                                <label className="mb-1 block font-medium">
                                    {dialogTarget === 'slide'
                                        ? `${getTerminology(ContentTerms.Slides, SystemTerms.Slides)} Name`
                                        : dialogTarget === 'chapter'
                                          ? `${getTerminology(ContentTerms.Chapters, SystemTerms.Chapters)} Name`
                                          : `${getTerminology(ContentTerms.Modules, SystemTerms.Modules)} Name`}{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={dialogName}
                                    onChange={(e) => setDialogName(e.target.value)}
                                    className="w-full rounded border px-2 py-1"
                                    placeholder={`Enter ${dialogTarget} name`}
                                />
                            </div>
                        </div>
                    )}

                    {dialogMode === 'add' && dialogTarget === 'slide' && (
                        <div className="space-y-1">
                            <span className="font-medium">
                                Type of{' '}
                                {getTerminology(
                                    ContentTerms.Slides,
                                    SystemTerms.Slides
                                ).toLocaleLowerCase()}{' '}
                                <span className="text-red-500">*</span>
                            </span>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                {allSlideTypes.map((slideType) => {
                                    const option = {
                                        value: slideType,
                                        label: slideType,
                                        icon: '📄',
                                    };
                                    const t = {
                                        val: option.value as typeof dialogSlideType,
                                        label: option.label,
                                        icon: option.icon,
                                        style: getSlideTypeStyle(option.value),
                                    };
                                    const disabled = !t.val || !allowedSlideTypes.includes(t.val);
                                    return (
                                        <button
                                            key={t.val}
                                            disabled={disabled}
                                            onClick={() =>
                                                !disabled && setDialogSlideType(t.val as any)
                                            }
                                            className={`flex items-center gap-1 rounded px-3 py-2 text-xs font-semibold ${t.style} ${dialogSlideType === t.val ? 'ring-2 ring-black/50' : ''} ${disabled ? 'cursor-not-allowed opacity-30' : ''}`}
                                        >
                                            <span>{t.icon}</span>
                                            <span>{t.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        {dialogMode === 'add' ? (
                            <Button
                                disabled={
                                    !dialogName.trim() ||
                                    (dialogTarget === 'slide' && !dialogSlideType)
                                }
                                className="bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                onClick={handleDialogConfirm}
                            >
                                Add
                            </Button>
                        ) : (
                            <Button
                                className="bg-red-600 text-white hover:bg-red-700"
                                onClick={handleDialogConfirm}
                            >
                                Delete
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CourseExplorer;
