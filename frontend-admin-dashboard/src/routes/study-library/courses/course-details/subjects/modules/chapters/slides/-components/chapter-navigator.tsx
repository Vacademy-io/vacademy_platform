import { useState, useMemo } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useModulesWithChaptersStore } from '@/stores/study-library/use-modules-with-chapters-store';
import {
    CaretDown,
    CaretLeft,
    CaretRight,
    Check,
    File,
    MagnifyingGlass,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChapterNavigatorProps {
    currentChapterId: string;
    currentModuleId: string;
    courseId: string;
    levelId: string;
    subjectId: string;
    sessionId: string;
}

export const ChapterNavigator = ({
    currentChapterId,
    currentModuleId,
    courseId,
    levelId,
    subjectId,
    sessionId,
}: ChapterNavigatorProps) => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { modulesWithChaptersData } = useModulesWithChaptersStore();

    // Get current module and its chapters
    const currentModule = useMemo(() => {
        return modulesWithChaptersData?.find((m) => m.module.id === currentModuleId);
    }, [modulesWithChaptersData, currentModuleId]);

    const chapters = useMemo(() => {
        if (!currentModule) return [];
        return currentModule.chapters
            .filter((ch) => ch.chapter.status !== 'DELETED')
            .sort((a, b) => a.chapter.chapter_order - b.chapter.chapter_order);
    }, [currentModule]);

    // Get current chapter info
    const currentChapter = useMemo(() => {
        return chapters.find((ch) => ch.chapter.id === currentChapterId);
    }, [chapters, currentChapterId]);

    const currentChapterIndex = useMemo(() => {
        return chapters.findIndex((ch) => ch.chapter.id === currentChapterId);
    }, [chapters, currentChapterId]);

    // Filter chapters based on search
    const filteredChapters = useMemo(() => {
        if (!searchQuery.trim()) return chapters;
        const query = searchQuery.toLowerCase();
        return chapters.filter((ch) => (ch.chapter?.chapter_name ?? '').toLowerCase().includes(query));
    }, [chapters, searchQuery]);

    // Navigation handlers
    const navigateToChapter = (chapterId: string) => {
        setIsOpen(false);
        setSearchQuery('');
        navigate({
            to: '/study-library/courses/course-details/subjects/modules/chapters/slides',
            search: {
                courseId,
                levelId,
                subjectId,
                moduleId: currentModuleId,
                chapterId,
                slideId: '',
                sessionId,
            },
        });
    };

    const goToPreviousChapter = () => {
        if (currentChapterIndex > 0) {
            const prevChapter = chapters[currentChapterIndex - 1];
            if (prevChapter) {
                navigateToChapter(prevChapter.chapter.id);
            }
        }
    };

    const goToNextChapter = () => {
        if (currentChapterIndex < chapters.length - 1) {
            const nextChapter = chapters[currentChapterIndex + 1];
            if (nextChapter) {
                navigateToChapter(nextChapter.chapter.id);
            }
        }
    };

    const hasPrevious = currentChapterIndex > 0;
    const hasNext = currentChapterIndex < chapters.length - 1;

    // Get slide count for a chapter
    const getSlideCount = (ch: (typeof chapters)[0]) => {
        const counts = ch.slides_count;
        return counts.video_count + counts.pdf_count + counts.doc_count + counts.unknown_count;
    };

    if (!currentModule || chapters.length === 0) {
        return null;
    }

    return (
        <div className="flex w-full max-w-full items-center gap-1 overflow-hidden px-1">
            {/* Previous Chapter Button */}
            <button
                onClick={goToPreviousChapter}
                disabled={!hasPrevious}
                className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-md transition-all duration-200',
                    hasPrevious
                        ? 'bg-white/80 text-neutral-600 hover:bg-primary-100 hover:text-primary-600 active:scale-95'
                        : 'cursor-not-allowed bg-neutral-100/50 text-neutral-300'
                )}
                title={
                    hasPrevious
                        ? `Previous: ${chapters[currentChapterIndex - 1]?.chapter.chapter_name}`
                        : 'No previous chapter'
                }
            >
                <CaretLeft className="size-4" weight="bold" />
            </button>

            {/* Chapter Selector Popover */}
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <button
                        className={cn(
                            'group flex min-w-0 flex-1 items-center justify-between gap-1 rounded-lg px-2 py-1.5',
                            'bg-white/80 backdrop-blur-sm transition-all duration-200',
                            'border border-neutral-200 hover:border-primary-300 hover:bg-primary-50/50',
                            'text-xs font-medium text-neutral-700 hover:text-primary-700',
                            'overflow-hidden',
                            isOpen && 'border-primary-400 bg-primary-50 text-primary-700'
                        )}
                    >
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                            <File className="size-3.5 shrink-0 text-primary-500" weight="duotone" />
                            <span className="truncate text-xs">
                                {currentChapter?.chapter.chapter_name || 'Select Chapter'}
                            </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            <span className="rounded-full bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-500 group-hover:bg-primary-100 group-hover:text-primary-600">
                                {currentChapterIndex + 1}/{chapters.length}
                            </span>
                            <CaretDown
                                className={cn(
                                    'size-3 text-neutral-400 transition-transform duration-200',
                                    isOpen && 'rotate-180 text-primary-500'
                                )}
                                weight="bold"
                            />
                        </div>
                    </button>
                </PopoverTrigger>

                <PopoverContent className="w-72 p-0" align="center" side="bottom" sideOffset={8}>
                    <div className="flex flex-col">
                        {/* Search Input */}
                        <div className="border-b border-neutral-100 p-2">
                            <div className="relative">
                                <MagnifyingGlass className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                                <Input
                                    placeholder="Search chapters..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-8 pl-8 text-sm"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Module Name Header */}
                        <div className="border-b border-neutral-100 bg-neutral-50/50 px-3 py-2">
                            <p className="text-xs font-medium text-neutral-500">
                                {currentModule.module.module_name}
                            </p>
                        </div>

                        {/* Chapter List */}
                        <ScrollArea className="max-h-64">
                            <div className="p-1">
                                {filteredChapters.length === 0 ? (
                                    <div className="px-3 py-6 text-center text-sm text-neutral-400">
                                        No chapters found
                                    </div>
                                ) : (
                                    filteredChapters.map((ch, index) => {
                                        const isActive = ch.chapter.id === currentChapterId;
                                        const slideCount = getSlideCount(ch);
                                        const originalIndex = chapters.findIndex(
                                            (c) => c.chapter.id === ch.chapter.id
                                        );

                                        return (
                                            <button
                                                key={ch.chapter.id}
                                                onClick={() => navigateToChapter(ch.chapter.id)}
                                                className={cn(
                                                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-all duration-150',
                                                    isActive
                                                        ? 'bg-primary-100 text-primary-700'
                                                        : 'text-neutral-600 hover:bg-neutral-100'
                                                )}
                                            >
                                                {/* Chapter Number */}
                                                <div
                                                    className={cn(
                                                        'flex size-6 shrink-0 items-center justify-center rounded text-xs font-semibold',
                                                        isActive
                                                            ? 'bg-primary-500 text-white'
                                                            : 'bg-neutral-200 text-neutral-500'
                                                    )}
                                                >
                                                    {originalIndex + 1}
                                                </div>

                                                {/* Chapter Name */}
                                                <div className="min-w-0 flex-1">
                                                    <p
                                                        className={cn(
                                                            'truncate text-sm font-medium',
                                                            isActive
                                                                ? 'text-primary-700'
                                                                : 'text-neutral-700'
                                                        )}
                                                    >
                                                        {ch.chapter.chapter_name}
                                                    </p>
                                                    <p className="text-xs text-neutral-400">
                                                        {slideCount}{' '}
                                                        {slideCount === 1 ? 'slide' : 'slides'}
                                                    </p>
                                                </div>

                                                {/* Active Indicator */}
                                                {isActive && (
                                                    <Check
                                                        className="size-4 shrink-0 text-primary-500"
                                                        weight="bold"
                                                    />
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </PopoverContent>
            </Popover>

            {/* Next Chapter Button */}
            <button
                onClick={goToNextChapter}
                disabled={!hasNext}
                className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-md transition-all duration-200',
                    hasNext
                        ? 'bg-white/80 text-neutral-600 hover:bg-primary-100 hover:text-primary-600 active:scale-95'
                        : 'cursor-not-allowed bg-neutral-100/50 text-neutral-300'
                )}
                title={
                    hasNext
                        ? `Next: ${chapters[currentChapterIndex + 1]?.chapter.chapter_name}`
                        : 'No next chapter'
                }
            >
                <CaretRight className="size-4" weight="bold" />
            </button>
        </div>
    );
};
