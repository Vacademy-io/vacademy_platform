import { useSidebar } from "@/components/ui/sidebar";
import { truncateString } from "@/lib/reusable/truncateString";
import { useModulesWithChaptersStore } from "@/stores/study-library/use-modules-with-chapters-store";
import { getModuleName } from "@/utils/study-library/get-name-by-id/getModuleNameById";
import { getSubjectName } from "@/utils/study-library/get-name-by-id/getSubjectNameById";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";

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
    const { courseId, subjectId, moduleId, levelId, sessionId } =
        router.state.location.search;
    const { open } = useSidebar();
    const { modulesWithChaptersData } = useModulesWithChaptersStore();
    const { studyLibraryData } = useStudyLibraryStore();

    const handleSubjectRoute = () => {
        navigate({
            to: "/study-library/courses/course-details/subjects/modules",
            params: {},
            search: {
                courseId: courseId || "",
                levelId: levelId || "",
                subjectId: subjectId || "",
                sessionId: sessionId || "",
            },
            hash: "",
        });
    };

    const [subjectName, setSubjectName] = useState("");
    const [moduleName, setModuleName] = useState("");
    const [truncatedModule, setTruncatedModule] = useState("");

    useEffect(() => {
        setSubjectName(getSubjectName(subjectId || "", studyLibraryData) || "");
        setModuleName(
            getModuleName(moduleId || "", modulesWithChaptersData) || ""
        );
        setTruncatedModule(truncateString(moduleName, 10));
    }, [studyLibraryData, modulesWithChaptersData]);

    return (
        <div className={`flex w-full flex-col gap-4 ${open ? "px-8" : "px-6"}`}>
            {/* Breadcrumb */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <p
                    className={`cursor-pointer text-neutral-500 hover:text-primary-600 transition-colors duration-200 ${open ? "visible" : "hidden"}`}
                    onClick={handleSubjectRoute}
                >
                    {subjectName}
                </p>
                <ChevronRightIcon
                    className={`size-4 text-neutral-400 ${open ? "visible" : "hidden"}`}
                />
                <p className="cursor-pointer text-primary-600 font-medium">
                    {open ? moduleName : truncatedModule}
                </p>
            </div>

            {/* Module List */}
            <div className="space-y-2">
                {modulesWithChaptersData &&
                    modulesWithChaptersData.map((moduleWithChapters, index) => (
                        <div
                            key={index}
                            className={`group flex w-full items-center gap-3 rounded-lg transition-all duration-200 px-3 py-2.5 hover:cursor-pointer ${
                                moduleWithChapters.module.id == currentModuleId
                                    ? "border border-primary-200/80 bg-gradient-to-r from-primary-50/80 to-blue-50/60 text-primary-700 shadow-sm"
                                    : "border border-transparent bg-white hover:border-neutral-200 hover:bg-gradient-to-r hover:from-neutral-50/80 hover:to-white text-neutral-600 hover:text-neutral-700 hover:shadow-sm"
                            }`}
                            onClick={() => {
                                setCurrentModuleId(
                                    moduleWithChapters.module.id
                                );
                            }}
                        >
                            <div
                                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-200 ${
                                    moduleWithChapters.module.id ==
                                    currentModuleId
                                        ? "bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-sm"
                                        : "bg-gradient-to-br from-neutral-200 to-neutral-300 text-neutral-600 group-hover:from-neutral-300 group-hover:to-neutral-400"
                                }`}
                            >
                                M{index + 1}
                            </div>
                            <p
                                className={`font-medium transition-colors duration-200 ${open ? "visible" : "hidden"}`}
                            >
                                {moduleWithChapters.module.module_name}
                            </p>
                        </div>
                    ))}
            </div>
        </div>
    );
};
