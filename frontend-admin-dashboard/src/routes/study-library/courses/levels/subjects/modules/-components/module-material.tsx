import { AddModulesButton } from './add-modules.tsx/add-modules-button';
import { Modules } from './add-modules.tsx/modules';
import { Module } from '@/stores/study-library/use-modules-with-chapters-store';
import { useRouter } from '@tanstack/react-router';
import { useModulesWithChaptersStore } from '@/stores/study-library/use-modules-with-chapters-store';
import { useAddModule } from '@/routes/study-library/courses/levels/subjects/modules/-services/add-module';
import { useUpdateModule } from '@/routes/study-library/courses/levels/subjects/modules/-services/update-module';
import { useDeleteModule } from '@/routes/study-library/courses/levels/subjects/modules/-services/delete-module';
import { getLevelName } from '@/utils/helpers/study-library-helpers.ts/get-name-by-id/getLevelNameById';
import { getSubjectName } from '@/utils/helpers/study-library-helpers.ts/get-name-by-id/getSubjectNameById';
import { useUpdateModuleOrder } from '@/routes/study-library/courses/levels/subjects/modules/-services/update-modules-order';
import { orderModulePayloadType } from '@/routes/study-library/courses/-types/order-payload';
import useIntroJsTour from '@/hooks/use-intro';
import { StudyLibraryIntroKey } from '@/constants/storage/introKey';
import { studyLibrarySteps } from '@/constants/intro/steps';
import { useEffect, useState } from 'react';
import {
    DropdownItemType,
    DropdownValueType,
} from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { MyDropdown } from '@/components/common/students/enroll-manually/dropdownForPackageItems';

export const ModuleMaterial = () => {
    const router = useRouter();
    const { modulesWithChaptersData } = useModulesWithChaptersStore();
    const { getSessionsByCourseLevelSubject } = useStudyLibraryStore();

    const addModuleMutation = useAddModule();
    const updateModuleMutation = useUpdateModule();
    const deleteModuleMutation = useDeleteModule();
    const updateModuleOrderMutation = useUpdateModuleOrder();

    const { courseId, subjectId, levelId } = router.state.location.search;

    const [sessionList, setSessionList] = useState<DropdownItemType[]>(
        courseId && levelId && subjectId
            ? getSessionsByCourseLevelSubject({
                  courseId: courseId,
                  levelId: levelId,
                  subjectId: subjectId,
              })
            : []
    );
    const initialSession: DropdownItemType | undefined = {
        id: sessionList[0]?.id || '',
        name: sessionList[0]?.name || '',
    };

    const [currentSession, setCurrentSession] = useState<DropdownItemType | undefined>(
        () => initialSession
    );

    useEffect(() => {
        setSessionList(
            courseId && levelId && subjectId
                ? getSessionsByCourseLevelSubject({
                      courseId: courseId,
                      levelId: levelId,
                      subjectId: subjectId,
                  })
                : []
        );
    }, [courseId, levelId, subjectId]);

    useEffect(() => {
        setCurrentSession({ id: sessionList[0]?.id || '', name: sessionList[0]?.name || '' });
    }, [sessionList]);

    const handleSessionChange = (value: DropdownValueType) => {
        if (value && typeof value === 'object' && 'id' in value && 'name' in value) {
            setCurrentSession(value as DropdownItemType);
            const search = router.state.location.search;
            router.navigate({
                search: {
                    ...search,
                    sessionId: value.id,
                    // eslint-disable-next-line
                } as any,
            });
        }
    };

    useIntroJsTour({
        key: StudyLibraryIntroKey.addModulesStep,
        steps: studyLibrarySteps.addModulesStep,
    });

    // Ensure courseId, subjectId, and levelId exist before proceeding
    if (!courseId) return <>Course Not found</>;
    if (!subjectId) return <>Subject Not found</>;
    if (!levelId) return <>Level Not found</>;

    const subject = getSubjectName(subjectId);
    const levelName = getLevelName(levelId);

    // const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    //     setSearchInput(e.target.value);
    // };

    const handleAddModule = (module: Module) => {
        addModuleMutation.mutate({ subjectId, module });
    };

    const handleDeleteModule = (module: Module) => {
        deleteModuleMutation.mutate(module.id);
    };

    const handleEditModule = (updatedModule: Module) => {
        updateModuleMutation.mutate({ moduleId: updatedModule.id, module: updatedModule });
    };

    const handleUpdateModuleOrder = (orderPayload: orderModulePayloadType[]) => {
        updateModuleOrderMutation.mutate({
            updatedModules: orderPayload,
        });
    };

    const isLoading =
        addModuleMutation.isPending ||
        deleteModuleMutation.isPending ||
        updateModuleMutation.isPending;

    return (
        <div className="flex size-full flex-col gap-8 text-neutral-600">
            <div className="flex items-center justify-between gap-8">
                <div className="flex w-full flex-col gap-2">
                    <div className="text-h3 font-semibold">Manage Your Modules</div>
                    <div className="text-subtitle">
                        Explore and manage modules for {levelName} {subject}. Click on a module to
                        view and organize chapters, eBooks, and video lectures, or add new resources
                        to expand your study materials.
                    </div>
                </div>
                <AddModulesButton onAddModule={handleAddModule} />
            </div>
            <div className="flex items-center gap-6">
                <MyDropdown
                    currentValue={currentSession ?? undefined}
                    dropdownList={sessionList}
                    placeholder="Select Session"
                    handleChange={handleSessionChange}
                />
            </div>
            <Modules
                modules={modulesWithChaptersData}
                onDeleteModule={handleDeleteModule}
                onEditModule={handleEditModule}
                subjectId={subjectId}
                isLoading={isLoading}
                onOrderChange={handleUpdateModuleOrder}
            />
        </div>
    );
};
