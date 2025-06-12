// chapters.tsx
import { EmptyChaptersImage } from "@/assets/svgs";
import { ChapterCard } from "./chapter-card";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { Sortable, SortableItem } from "@/components/ui/sortable";
import { useFieldArray, UseFormReturn } from "react-hook-form";
import { FormValues } from "../chapter-material";
import { ChapterWithSlides } from "@/stores/study-library/use-modules-with-chapters-store";
import { useRouter } from "@tanstack/react-router";
import { useGetPackageSessionId } from "@/utils/helpers/study-library-helpers.ts/get-list-from-stores/getPackageSessionId";
import { useSelectedSessionStore } from "@/stores/study-library/selected-session-store";
import { orderChapterPayloadType } from "@/routes/study-library/courses/-types/order-payload";

interface ChaptersProps {
    chapters?: ChapterWithSlides[];
    onDeleteChapter?: ({ chapter }: { chapter: ChapterWithSlides }) => void;
    onOrderChange?: (updatedOrder: orderChapterPayloadType[]) => void;
    isLoading?: boolean;
    form: UseFormReturn<FormValues>;
}

export const Chapters = ({
    onDeleteChapter = () => {},
    onOrderChange,
    isLoading = false,
    form, // Add form prop
}: ChaptersProps) => {
    const route = useRouter();
    const { courseId = "", levelId = "" } = route.state.location.search;
    const { selectedSession } = useSelectedSessionStore();

    const packageSessionId =
        useGetPackageSessionId(courseId, selectedSession?.id || "", levelId) || "";

    const { fields, move } = useFieldArray({
        control: form.control,
        name: "chapters",
    });

    const handleMove = ({ activeIndex, overIndex }: { activeIndex: number; overIndex: number }) => {
        move(activeIndex, overIndex);

        // Create order payload after move
        const updatedFields = form.getValues("chapters");

        // Create order payload with the updated order
        const orderPayload = updatedFields.map((chapter, index) => ({
            chapter_id: chapter.chapter.id,
            package_session_id: packageSessionId,
            chapter_order: index + 1,
        }));
        console.log("order payload: ", orderPayload);

        // Call onOrderChange with the updated order
        onOrderChange?.(orderPayload);
    };

    if (courseId == "" || levelId == "") {
        return <div>Missing course or level details parameters</div>;
    }

    if (isLoading) {
        return <DashboardLoader />;
    }

    return (
        <div className="h-full w-full">
            {!fields.length && (
                <div className="flex w-full flex-col items-center justify-center gap-8 rounded-lg py-10">
                    <EmptyChaptersImage />
                    <div>No Chapters have been added yet.</div>
                </div>
            )}
            <Sortable value={fields} onMove={handleMove} fast={false}>
                <div className="flex flex-col gap-6">
                    {fields.map((chapter, index) => (
                        <SortableItem key={chapter.id} value={chapter.id} asChild>
                            <div className="cursor-grab active:cursor-grabbing" key={index}>
                                <ChapterCard
                                    chapter={chapter}
                                    onDelete={() => onDeleteChapter({ chapter: chapter })}
                                />
                            </div>
                        </SortableItem>
                    ))}
                </div>
            </Sortable>
        </div>
    );
};
