import { Doubt as DoubtType} from "../types/get-doubts-type"
import { DashboardLoader } from "@/components/core/dashboard-loader"
import { Doubt } from "./doubt"
import { DoubtFilter } from "../types/get-doubts-type"

export const DoubtList = ({allDoubts, isLoading, lastDoubtElementRef, filter, refetch, isFetchingNextPage, status}:{allDoubts:  DoubtType[], isLoading: boolean, lastDoubtElementRef: (node: HTMLDivElement) => void, filter: DoubtFilter, refetch: () => void, isFetchingNextPage: boolean, status: string}) => {
    
    // Only show empty state if we're not loading and we truly have no doubts
    const shouldShowEmptyState = !isLoading && !isFetchingNextPage && allDoubts.length === 0;

    console.log("allDoubts from DoubtList: ", allDoubts)
    
    return(
        <div>
        {isLoading && <DashboardLoader />}
        {!isLoading && allDoubts && allDoubts?.length > 0 ?
        allDoubts?.map((doubt, index) => (
            <div 
                key={doubt.id || index}
                ref={index === allDoubts.length - 1 ? lastDoubtElementRef : undefined}
            >
                <Doubt
                    doubt={doubt} 
                    filter={filter}
                    refetch={refetch}
                />
            </div>
        ))
        :
        shouldShowEmptyState && (
        <div className="flex flex-col h-full items-center justify-center min-h-[70vh] "> 
            <p className="text-center text-xl text-neutral-600">No doubts {status === "ALL" ? "added" : status=="RESOLVED" ? "resolved" : "unresolved" }</p>
            { status === "ALL" && <p className="text-sm text-neutral-500">Add your first doubt</p>}
        </div>
        )
    }
        {isFetchingNextPage && <DashboardLoader />}
        </div>
    )
}