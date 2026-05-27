import { EmptyChaptersImage } from "@/assets/svgs";
import { ChapterCard } from "./chapter-card";
import { Chapter } from "@/stores/study-library/use-modules-with-chapters-store";
import { getTerminologyPlural } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

export const Chapters = ({ chapters}:{chapters:Chapter[]}) => {
    return(
        <div className=" w-full flex flex-col items-center justify-center">
        {!chapters.length && (
            <div className="flex w-full h-screen-70 flex-col items-center justify-center gap-8 rounded-lg">
                    <EmptyChaptersImage />
                    <div>No {getTerminologyPlural(ContentTerms.Chapters, SystemTerms.Chapters)} have been added yet.</div>
                </div>
            )}
            <div className="flex flex-col gap-6 w-full">
                {chapters.map((chapter, index) => (
                    <ChapterCard
                        key={index}
                        chapter={chapter}
                    />
                ))}
                
            </div>
        </div>
    )
}