import { QuestionEntityData, QuestionPaperEntityData } from "@/types/community/filters/types";
import { useNavigate } from "@tanstack/react-router";
import RandomImage from "./RandomImage";

interface DataCardProps {
    data: QuestionEntityData | QuestionPaperEntityData;
    title?: string;
}

export function DataCard({ title, data }: DataCardProps) {
    const navigate = useNavigate();

    const navigateToDisplayQuestionPaper = () => {
        console.log("here");
        console.log("data : ", data);
        if ("id" in data) {
            navigate({
                to: `/community/question-paper`,
                search: { id: data.id },
            });
        }
    };
    return (
        <div
            className="flex cursor-pointer flex-col gap-4 rounded-lg border p-4 shadow-md"
            onClick={navigateToDisplayQuestionPaper}
        >
            <div className="h-[214px] w-full rounded-md border">
                <RandomImage />
            </div>
            <div className="flex flex-col gap-8">
                <div className="text-title font-bold">{title}</div>
                {/* <div className="text-subtitle"></div>
                <div></div> */}
            </div>
        </div>
    );
}
