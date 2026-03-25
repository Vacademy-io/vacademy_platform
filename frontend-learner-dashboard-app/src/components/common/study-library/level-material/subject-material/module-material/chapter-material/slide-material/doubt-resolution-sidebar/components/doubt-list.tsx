import { Doubt as DoubtType} from "../types/get-doubts-type"

import { Doubt } from "./doubt"
import { DoubtFilter } from "../types/get-doubts-type"
import { ChatText, CheckCircle, Clock } from "@phosphor-icons/react"

export const DoubtList = ({allDoubts, isLoading, lastDoubtElementRef, filter, refetch, isFetchingNextPage, status}:{allDoubts:  DoubtType[], isLoading: boolean, lastDoubtElementRef: (node: HTMLDivElement) => void, filter: DoubtFilter, refetch: () => void, isFetchingNextPage: boolean, status: string}) => {
    
    // Only show empty state if we're not loading and we truly have no doubts
    const shouldShowEmptyState = !isLoading && !isFetchingNextPage && allDoubts.length === 0;

    console.log("allDoubts from DoubtList: ", allDoubts)

    const getEmptyStateContent = () => {
        switch(status) {
            case "RESOLVED":
                return {
                    icon: <CheckCircle size={48} className="text-green-400" />,
                    title: "No Resolved Doubts",
                    subtitle: "Doubts you mark as resolved will appear here"
                };
            case "ACTIVE":
                return {
                    icon: <Clock size={48} className="text-amber-400" />,
                    title: "No Pending Doubts",
                    subtitle: "All your doubts have been resolved!"
                };
            default:
                return {
                    icon: <ChatText size={48} className="text-primary-400" />,
                    title: "No Doubts Yet",
                    subtitle: "Ask your first doubt to get started with learning"
                };
        }
    };

    const emptyState = getEmptyStateContent();
    
    return(
        <div className="space-y-4">
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <div className="relative">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-blue-400 rounded-full animate-spin" style={{ animationDelay: '0.1s', animationDirection: 'reverse' }}></div>
                    </div>
                </div>
            )}
            
            {!isLoading && allDoubts && allDoubts?.length > 0 ?
                allDoubts?.map((doubt, index) => (
                    <div 
                        key={doubt.id || index}
                        ref={index === allDoubts.length - 1 ? lastDoubtElementRef : undefined}
                        className="animate-in fade-in slide-in-from-bottom-4 duration-300"
                        style={{ animationDelay: `${index * 50}ms` }}
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
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in slide-in-from-bottom-8 duration-500"> 
                        <div className="relative mb-6">
                            <div className="absolute -inset-2 bg-gradient-to-r from-primary-500/20 to-blue-600/20 rounded-full blur"></div>
                            <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-full p-4">
                                {emptyState.icon}
                            </div>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">{emptyState.title}</h3>
                        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">{emptyState.subtitle}</p>
                    </div>
                )
            }
            
            {isFetchingNextPage && (
                <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2 text-gray-500">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin"></div>
                        <span className="text-sm">Loading more doubts...</span>
                    </div>
                </div>
            )}
        </div>
    )
}