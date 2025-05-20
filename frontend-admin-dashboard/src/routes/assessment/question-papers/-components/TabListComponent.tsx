import { Badge } from "@/components/ui/badge";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaginatedResponse } from "@/types/assessments/question-paper-template";

export const TabListComponent = ({
    selectedTab,
    questionPaperList,
    questionPaperFavouriteList,
}: {
    selectedTab: string;
    questionPaperList: PaginatedResponse;
    questionPaperFavouriteList: PaginatedResponse;
}) => {
    return (
        <TabsList className="inline-flex h-auto justify-start gap-4 rounded-none border-b-[1px] !bg-transparent p-0">
            <TabsTrigger
                value="ACTIVE"
                className={`flex gap-1.5 rounded-none pb-2 pl-12 pr-12 pt-2 !shadow-none ${
                    selectedTab === "ACTIVE"
                        ? "border-4px rounded-tl-sm rounded-tr-sm border !border-b-0 border-primary-200 !bg-primary-50"
                        : "border-none bg-transparent"
                }`}
            >
                <span className={`${selectedTab === "All" ? "text-primary-500" : ""}`}>All</span>
                <Badge
                    className="rounded-[10px] bg-primary-500 p-0 px-2 text-[9px] text-white"
                    variant="outline"
                >
                    {questionPaperList.total_elements}
                </Badge>
            </TabsTrigger>
            <TabsTrigger
                value="FAVOURITE"
                className={`inline-flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                    selectedTab === "FAVOURITE"
                        ? "rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50"
                        : "border-none bg-transparent"
                }`}
            >
                <span className={`${selectedTab === "Favourites" ? "text-primary-500" : ""}`}>
                    Favourites
                </span>
                <Badge
                    className="rounded-[10px] bg-primary-500 p-0 pl-2 pr-2 text-[9px] text-white"
                    variant="outline"
                >
                    {questionPaperFavouriteList.content.length}
                </Badge>
            </TabsTrigger>
        </TabsList>
    );
};
