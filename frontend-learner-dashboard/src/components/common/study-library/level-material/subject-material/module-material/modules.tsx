import { EmptyModulesImage } from "@/assets/svgs"
import { ModuleCard } from "./module-card"
import { useSidebar } from "@/components/ui/sidebar"
import { ModulesWithChapters } from "@/stores/study-library/use-modules-with-chapters-store";
import { useEffect, useState } from "react";

interface ModulesProps {
    modules: ModulesWithChapters[] | null;
}

export const Modules = ({modules: initialModules }:ModulesProps) => {

    const [modules, setModules] = useState<ModulesWithChapters[] | null>(initialModules);
    const {open} = useSidebar();

    useEffect(() => {
        setModules(initialModules);
    }, [initialModules]);

    return(
        <div className=" w-full flex flex-col items-center justify-center">
        {!modules?.length && (
            <div className="flex w-full h-[70vh] flex-col items-center justify-center gap-8 rounded-lg">
                    <EmptyModulesImage />
                    <div>No Modules have been added yet.</div>
                </div>
            )}
            <div className={`grid xs:grid-cols-1 md-tablets:grid-cols-2 ${open?"sm:grid-cols-1":"sm:grid-cols-2"} gap-6 w-full`}>
                {modules?.map((moduleWithChapters, index) => (
                    <ModuleCard
                        key={index}
                        module={moduleWithChapters}
                    />
                ))}
            </div>
        </div>
    )
}