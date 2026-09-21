import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MyButton } from '@/components/design-system/button';
import {
    useStudyLibraryStore,
    type SubjectType,
} from '@/stores/study-library/use-study-library-store';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useStudyLibraryQuery } from '@/routes/study-library/courses/-services/getStudyLibraryDetails';
import { handleFetchModulesWithChapters } from '@/routes/study-library/courses/-services/getModulesWithChapters';
import { handleFetchSlides } from '@/routes/study-library/courses/-services/getAllSlides';

/** What the composer stores when a slide is chosen. */
export interface PickedSlide {
    slideId: string;
    slideTitle: string;
    slideType?: string;
    /** Everything the learner app needs to deep-link into the slide. */
    courseId?: string;
    sessionId?: string;
    levelId?: string;
    subjectId: string;
    moduleId: string;
    chapterId: string;
}

interface ChapterLike {
    id: string;
    chapter_name?: string;
    chapter_dto?: { id: string; chapter_name?: string };
}

interface ModuleLike {
    module: { id: string; module_name?: string };
    chapters: ChapterLike[];
}

interface SlideLike {
    id: string;
    title?: string;
    source_type?: string;
}

/**
 * Pick an existing slide out of the course library.
 *
 * Cascades subject → module → chapter → slide against the batch's own course,
 * session and level, mirroring the live-session destination picker so the shape of
 * the data is one that is already proven against these APIs.
 */
export function CourseSlidePicker({
    open,
    onOpenChange,
    packageSessionId,
    onPick,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    packageSessionId: string;
    onPick: (slide: PickedSlide) => void;
}) {
    const { t } = useTranslation('engagement');
    const [subjectId, setSubjectId] = useState('');
    const [moduleId, setModuleId] = useState('');
    const [chapterId, setChapterId] = useState('');
    const [slideId, setSlideId] = useState('');

    const { studyLibraryData } = useStudyLibraryStore();
    const { getDetailsFromPackageSessionId } = useInstituteDetailsStore();
    const studyLibraryQuery = useStudyLibraryQuery();
    useQuery({ ...studyLibraryQuery, enabled: open });

    const context = useMemo(() => {
        const details = getDetailsFromPackageSessionId({ packageSessionId });
        return {
            courseId: details?.package_dto?.id,
            sessionId: details?.session?.id,
            levelId: details?.level?.id,
        };
    }, [packageSessionId, getDetailsFromPackageSessionId]);

    const subjects: SubjectType[] = useMemo(() => {
        const course = studyLibraryData?.find((c) => c.course.id === context.courseId);
        const session = course?.sessions.find((s) => s.session_dto.id === context.sessionId);
        const level = session?.level_with_details.find((l) => l.id === context.levelId);
        return level?.subjects ?? [];
    }, [studyLibraryData, context]);

    const modulesQuery = useQuery({
        ...handleFetchModulesWithChapters(subjectId, packageSessionId),
        enabled: open && Boolean(subjectId),
    });
    // Memoised because `?? []` would otherwise hand the chapters memo a new array
    // identity on every render.
    const modules: ModuleLike[] = useMemo(
        () => (modulesQuery.data as ModuleLike[]) ?? [],
        [modulesQuery.data]
    );

    const chapters: ChapterLike[] = useMemo(() => {
        const found = modules.find((m) => m.module?.id === moduleId);
        return found?.chapters ?? [];
    }, [modules, moduleId]);

    const slidesQuery = useQuery({
        ...handleFetchSlides(chapterId),
        enabled: open && Boolean(chapterId),
    });
    const slides: SlideLike[] = useMemo(
        () => (slidesQuery.data as SlideLike[]) ?? [],
        [slidesQuery.data]
    );

    function chapterIdOf(chapter: ChapterLike): string {
        return chapter.chapter_dto?.id ?? chapter.id;
    }
    function chapterNameOf(chapter: ChapterLike): string {
        return chapter.chapter_dto?.chapter_name ?? chapter.chapter_name ?? 'Chapter';
    }

    const chosen = slides.find((s) => s.id === slideId);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-screen w-full overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="text-start">{t('slidePicker.title')}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <p className="text-sm text-neutral-500">{t('slidePicker.hint')}</p>

                    <div className="space-y-1.5">
                        <Label>{t('slidePicker.subject')}</Label>
                        <Select
                            value={subjectId}
                            onValueChange={(v) => {
                                setSubjectId(v);
                                setModuleId('');
                                setChapterId('');
                                setSlideId('');
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t('slidePicker.selectSubject')} />
                            </SelectTrigger>
                            <SelectContent>
                                {subjects.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.subject_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {subjects.length === 0 && (
                            <p className="text-xs text-neutral-500">
                                {t('slidePicker.noSubjects')}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label>{t('slidePicker.module')}</Label>
                        <Select
                            value={moduleId}
                            disabled={!subjectId || modulesQuery.isLoading}
                            onValueChange={(v) => {
                                setModuleId(v);
                                setChapterId('');
                                setSlideId('');
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue
                                    placeholder={
                                        modulesQuery.isLoading
                                            ? t('slidePicker.loading')
                                            : t('slidePicker.selectModule')
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {modules.map((m) => (
                                    <SelectItem key={m.module.id} value={m.module.id}>
                                        {m.module.module_name ?? 'Module'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>{t('slidePicker.chapter')}</Label>
                        <Select
                            value={chapterId}
                            disabled={!moduleId}
                            onValueChange={(v) => {
                                setChapterId(v);
                                setSlideId('');
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t('slidePicker.selectChapter')} />
                            </SelectTrigger>
                            <SelectContent>
                                {chapters.map((c) => (
                                    <SelectItem key={chapterIdOf(c)} value={chapterIdOf(c)}>
                                        {chapterNameOf(c)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label>{t('slidePicker.slide')}</Label>
                        <Select
                            value={slideId}
                            disabled={!chapterId || slidesQuery.isLoading}
                            onValueChange={setSlideId}
                        >
                            <SelectTrigger>
                                <SelectValue
                                    placeholder={
                                        slidesQuery.isLoading
                                            ? t('slidePicker.loading')
                                            : t('slidePicker.selectSlide')
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {slides.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.title ?? 'Slide'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        {t('slidePicker.cancel')}
                    </Button>
                    <MyButton
                        type="button"
                        disable={!slideId}
                        onClick={() => {
                            if (!chosen) return;
                            onPick({
                                slideId: chosen.id,
                                slideTitle: chosen.title ?? 'Lesson',
                                slideType: chosen.source_type,
                                courseId: context.courseId,
                                sessionId: context.sessionId,
                                levelId: context.levelId,
                                subjectId,
                                moduleId,
                                chapterId,
                            });
                            onOpenChange(false);
                        }}
                    >
                        {t('slidePicker.use')}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
