import { DataCard } from "./DataCard";
import { useMutation } from "@tanstack/react-query";
import { getFilteredEntityData, mapFiltersToTags } from "../-services/utils";
// import { FilterOption } from "@/types/assessments/question-paper-filter";
import { useState, useEffect } from "react";
import { MyPagination } from "@/components/design-system/pagination";
import {
    QuestionEntityData,
    QuestionPaperEntityData,
    Entity,
    FilterRequest,
} from "@/types/community/filters/types";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { useSelectedFilterStore } from "../-store/useSlectedFilterOption";
import { useFilterStore } from "../-store/useFilterOptions";

export function FilteredDataList() {
    const [questionPaperList, setQuestionPaperList] = useState<
        Array<Entity<QuestionEntityData> | Entity<QuestionPaperEntityData>>
    >([]);
    const [currentPage, setCurrentPage] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [totalPages, setTotalPages] = useState<number>(0);
    const { selected, name } = useSelectedFilterStore();
    const { selectedChips } = useFilterStore();

    const pageSize = 8;
    const getFilteredData = useMutation({
        mutationFn: ({
            pageNo,
            pageSize,
            data,
        }: {
            pageNo: number;
            pageSize: number;
            data: FilterRequest;
        }) => getFilteredEntityData(pageNo, pageSize, data),
        onSuccess: (data) => {
            setQuestionPaperList(data.content);
            setIsLoading(false);
        },
        onError: (error: unknown) => {
            setIsLoading(false);
            throw error;
        },
    });

    useEffect(() => {
        setIsLoading(true);
        getFilteredData.mutate({
            pageNo: currentPage,
            pageSize,
            data: mapFiltersToTags(),
        });
    }, [currentPage, selected, name, selectedChips]);

    useEffect(() => {
        setIsLoading(true);
        const timeoutId = setTimeout(() => {
            getFilteredEntityData(0, pageSize, { type: "QUESTION_PAPER" })
                .then((data) => {
                    setQuestionPaperList(data.content);
                    setTotalPages(data.totalPages);
                    setIsLoading(false);
                })
                .catch((error) => {
                    console.error(error);
                    setIsLoading(false);
                });
        }, 0);

        return () => {
            clearTimeout(timeoutId);
        };
    }, []);

    function renderDataCard(entity: Entity<QuestionEntityData> | Entity<QuestionPaperEntityData>) {
        if (entity.entityType === "QUESTION_PAPER") {
            const questionPaperData = entity.entityData as QuestionPaperEntityData;
            return (
                <DataCard
                    key={questionPaperData.id}
                    data={questionPaperData}
                    title={questionPaperData.title}
                />
            );
        } else if (entity.entityType === "QUESTION") {
            const questionData = entity.entityData as QuestionEntityData;
            return <DataCard key={questionData.id} data={questionData} title={""} />;
        } else return <></>;
    }
    if (isLoading) return <DashboardLoader />;
    return (
        <>
            <div className="mx-10 mb-4 grid grid-cols-4 gap-6">
                {questionPaperList?.map((entity) => renderDataCard(entity))}
            </div>
            <MyPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            ></MyPagination>
        </>
    );
}
