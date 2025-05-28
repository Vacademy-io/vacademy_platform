import { DashboardLoader } from "@/components/core/dashboard-loader";
import { useStudyLibraryQuery } from "@/routes/study-library/courses/-services/getStudyLibraryDetails";
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export const InitStudyLibraryProvider = ({ children }: { children: React.ReactNode }) => {
    const queryClient = useQueryClient();

    const { studyLibraryData } = useStudyLibraryStore();

    // Trigger refetch manually on mount
    useEffect(() => {
        if (studyLibraryData == null)
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
    }, [queryClient]);

    const { isLoading } = useQuery({
        ...useStudyLibraryQuery(),
    });

    return <div className="flex flex-1 flex-col">{isLoading ? <DashboardLoader /> : children}</div>;
};
