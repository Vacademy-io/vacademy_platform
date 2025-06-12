import { useModulesWithChaptersStore } from '@/stores/study-library/use-modules-with-chapters-store';
import { getModuleName } from '@/utils/helpers/study-library-helpers.ts/get-name-by-id/getModuleNameById';
import { getSubjectName } from '@/utils/helpers/study-library-helpers.ts/get-name-by-id/getSubjectNameById';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { Dispatch, SetStateAction } from 'react';

interface ChapterSidebarComponentProps {
    currentModuleId: string;
    setCurrentModuleId: Dispatch<SetStateAction<string>>;
}

export const ChapterSidebarComponent = ({
    currentModuleId,
    setCurrentModuleId,
}: ChapterSidebarComponentProps) => {
    const router = useRouter();
    const navigate = useNavigate();
    const { courseId, levelId, subjectId, moduleId, sessionId } = router.state.location.search;
    const { modulesWithChaptersData } = useModulesWithChaptersStore();

    if (!courseId || !levelId || !subjectId || !moduleId || !sessionId)
        return <p>Error in route</p>;

    const handleSubjectRoute = () => {
        navigate({
            to: '/study-library/courses/levels/subjects/modules',
            params: {},
            search: {
                courseId: courseId,
                levelId: levelId,
                subjectId: subjectId,
                sessionId: sessionId,
            },
            hash: '',
        });
    };

    const subjectName = getSubjectName(subjectId);
    const moduleName = getModuleName(moduleId);

    return (
        <div className={`flex w-full flex-col gap-6 px-3`}>
            <div className="flex flex-wrap items-center gap-1 text-neutral-500">
                <p className={`cursor-pointer `} onClick={handleSubjectRoute}>
                    {subjectName}
                </p>
                <ChevronRightIcon className={`size-4`} />
                <p className="cursor-pointer text-primary-500">{moduleName}</p>
            </div>
            {modulesWithChaptersData &&
                modulesWithChaptersData.map((moduleWithChapters, index) => (
                    <div
                        key={index}
                        className={`flex w-full items-center gap-3 rounded-lg ${
                            moduleWithChapters.module.id == currentModuleId
                                ? 'border border-neutral-300 bg-white text-primary-500'
                                : 'bg-none text-neutral-500'
                        } px-4 py-2 hover:cursor-pointer hover:border hover:border-neutral-300 hover:bg-white hover:text-primary-500`}
                        onClick={() => {
                            setCurrentModuleId(moduleWithChapters.module.id);
                        }}
                    >
                        <p className="text-h3 font-semibold">{`M${index + 1}`}</p>
                        <p>{moduleWithChapters.module.module_name}</p>
                    </div>
                ))}
        </div>
    );
};
