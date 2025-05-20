// module-material.tsx
import { useEffect, useState } from 'react';
import { AddChapterButton } from './chapter-material/add-chapters/add-chapter-button';
import { useForm } from 'react-hook-form';
import {
    ChapterWithSlides,
    useModulesWithChaptersStore,
} from '@/stores/study-library/use-modules-with-chapters-store';
// import { getModuleById } from "@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getModulesWithChaptersByModuleId";
import { Chapters } from './chapter-material/chapters';
import { getChaptersByModuleId } from '@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getChaptersByModuleId';
import { useRouter } from '@tanstack/react-router';
import { orderChapterPayloadType } from '@/routes/study-library/courses/-types/order-payload';
import { useUpdateChapterOrder } from '@/routes/study-library/courses/levels/subjects/modules/chapters/-services/update-chapter-order';
import useIntroJsTour from '@/hooks/use-intro';
import { StudyLibraryIntroKey } from '@/constants/storage/introKey';
import { studyLibrarySteps } from '@/constants/intro/steps';
import { useDeleteChapter } from '@/routes/study-library/courses/levels/subjects/modules/chapters/-services/delete-chapter';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { toast } from 'sonner';

export interface FormValues {
    chapters: ChapterWithSlides[];
}

export const ChapterMaterial = ({ currentModuleId }: { currentModuleId: string }) => {
    const [isChapterLoading, setIsChapterLoading] = useState(true);
    const { modulesWithChaptersData } = useModulesWithChaptersStore();
    // const [moduleWithChapters, setModulesWithChapters] = useState(getModuleById(currentModuleId));
    const [existingChapters, setExistingChapters] = useState(
        getChaptersByModuleId(currentModuleId) || []
    );
    const updateChapterOrderMutation = useUpdateChapterOrder();
    const deleteChapterMutation = useDeleteChapter();
    const { getPackageSessionId, getSessionNameById } = useInstituteDetailsStore();

    const router = useRouter();

    const { courseId, levelId, sessionId } = router.state.location.search;

    const form = useForm<FormValues>({
        defaultValues: {
            chapters: existingChapters,
        },
    });

    useIntroJsTour({
        key: StudyLibraryIntroKey.addChaptersStep,
        steps: studyLibrarySteps.addChaptersStep,
    });

    const handleDeleteChapter = async ({ chapter }: { chapter: ChapterWithSlides }) => {
        const packageSessionId = getPackageSessionId({
            courseId: courseId || '',
            levelId: levelId || '',
            sessionId: sessionId || '',
        });
        const chapterIds: string[] = [chapter.chapter.id];
        try {
            await deleteChapterMutation.mutateAsync({
                packageSessionIds: packageSessionId || '',
                chapterIds: chapterIds,
            });
            toast.success('Chapter deleted successfully');
        } catch {
            toast.error('Failed to delete chapter');
        }
    };

    const handleChapterOrderChange = (orderPayload: orderChapterPayloadType[]) => {
        updateChapterOrderMutation.mutate(orderPayload);
    };

    useEffect(() => {
        if (existingChapters) {
            form.reset({ chapters: existingChapters });
            setIsChapterLoading(false);
        }
    }, [existingChapters, form]);

    useEffect(() => {
        setExistingChapters(getChaptersByModuleId(currentModuleId) || []);
    }, [modulesWithChaptersData, currentModuleId]);

    return (
        <div className="flex size-full flex-col gap-8 text-neutral-600">
            <div className="flex items-center justify-between gap-80">
                <div className="flex w-full items-center justify-between gap-8">
                    <div className="flex w-full flex-col gap-2">
                        <p className="text-h3 font-semibold">Manage Chapter</p>
                        <p className="text-subtitle">
                            Explore and manage chapters. Click on a chapter to view and access
                            eBooks, video lectures, and study resources, or add new materials to
                            enhance your learning experience.
                        </p>
                    </div>
                    <AddChapterButton />
                </div>
            </div>
            <div className="flex items-center gap-6">
                <p>Session: {getSessionNameById(sessionId || '')}</p>
            </div>
            {/* Add your module content here */}
            <Chapters
                form={form}
                chapters={form.watch('chapters')}
                onDeleteChapter={handleDeleteChapter}
                isLoading={isChapterLoading}
                onOrderChange={handleChapterOrderChange}
            />
        </div>
    );
};
