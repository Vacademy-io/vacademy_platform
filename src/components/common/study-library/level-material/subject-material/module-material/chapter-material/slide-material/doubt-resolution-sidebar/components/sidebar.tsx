import { MyButton } from "@/components/design-system/button";
// Removed Sidebar UI components - using custom divs for full control
import { useDoubtSidebarStore } from "@/stores/study-library/doubt-sidebar-store"
import { X, ChatText, Plus, CheckCircle, Clock } from "@phosphor-icons/react"
import {  useState, useRef, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainViewQuillEditor } from "@/components/quill/MainViewQuillEditor";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { DoubtFilter, Doubt as DoubtType } from "../types/get-doubts-type";
import { useGetDoubts } from "../services/GetDoubts";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { AddDoubt } from "./AddDoubt";
import { DoubtList } from "./doubt-list";
import { TimestampDialog } from "./TimestampDialog";
import { TimestampChip } from "./TimestampChip";

export const DoubtResolutionSidebar = () => {

    const { isOpen: open, closeSidebar } = useDoubtSidebarStore();
    const [showInput, setShowInput] = useState<boolean>(false)
    const [doubt, setDoubt] = useState<string>("")
    const [showTimestampDialog, setShowTimestampDialog] = useState<boolean>(false)
    const [timestamp, setTimestamp] = useState<number | undefined>(undefined)
    const [formattedTime, setFormattedTime] = useState<string | undefined>(undefined)
    const {activeItem} = useContentStore();
    const observer = useRef<IntersectionObserver | null>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    
    const [filter, setFilter] = useState<DoubtFilter>({
        name: "",
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        user_ids: [],
        content_positions: [],
        content_types: [activeItem?.source_type=="DOCUMENT" ? activeItem?.document_slide?.type || "": activeItem?.source_type || ""],
        sources: ["SLIDE"],
        source_ids: [activeItem?.id || ""],
        status: ["ACTIVE", "RESOLVED"],
        sort_columns: {
            "created_at" : "DESC"
        },
    })
    
    const {data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isPending} = useGetDoubts(filter);

    const [allDoubts, setAllDoubts] = useState<DoubtType[]>(data?.pages.flatMap(page => page.content) || []);
    
    // Handle click outside sidebar to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (open && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                // Check if the click is on the sidebar trigger button
                const triggerElement = document.querySelector('[data-sidebar="trigger"]');
                if (triggerElement && triggerElement.contains(event.target as Node)) {
                    return; // Don't close if clicking on the trigger
                }
                
                // Check if the click is inside an AlertDialog
                const alertDialogElement = (event.target as Element).closest('[role="alertdialog"]');
                if (alertDialogElement) {
                    return; // Don't close if clicking inside a dialog
                }
                
                // Check if the click is inside a Dialog (for timestamp dialog)
                const dialogElement = (event.target as Element).closest('[role="dialog"]');
                if (dialogElement) {
                    return; // Don't close if clicking inside a dialog
                }
                
                closeSidebar();
            }
        };

        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open, closeSidebar]);
    
    useEffect(()=>{
        setAllDoubts(data?.pages.flatMap(page => page.content) || []);
    }, [data])
    
    useEffect(()=>{
        setFilter(prev => ({...prev, source_ids: [activeItem?.id || ""], content_types: [activeItem?.source_type=="DOCUMENT" ? activeItem?.document_slide?.type || "": activeItem?.source_type || ""]}))
    }, [activeItem])
    
    useEffect(()=>{
        refetch();
    }, [filter])

    const handleTabChange = (value: string) => {
        if (value === "RESOLVED") {
            setFilter(prev => ({...prev, status: ["RESOLVED"]}));
        } else if (value === "UNRESOLVED") {
            setFilter(prev => ({...prev, status: ["ACTIVE"]}));
        } else {
            setFilter(prev => ({...prev, status: ["ACTIVE", "RESOLVED"]}));
        }
    }

    const lastDoubtElementRef = useCallback((node: HTMLDivElement) => {
        if (isLoading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
            }
        });
        if (node) observer.current.observe(node);
    }, [isLoading, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const handleTimestampSet = (newTimestamp: number, newFormattedTime: string) => {
        setTimestamp(newTimestamp);
        setFormattedTime(newFormattedTime);
        setShowTimestampDialog(false);
        setShowInput(true);
    };

    const handleTimestampEdit = () => {
        // Only allow timestamp editing for video slides
        if (activeItem?.source_type === "VIDEO") {
            setShowTimestampDialog(true);
        }
    };

    const handleAskDoubtClick = () => {
        setTimestamp(undefined);
        setFormattedTime(undefined);
        
        // Only show timestamp dialog for video slides
        if (activeItem?.source_type === "VIDEO") {
            setShowTimestampDialog(true);
        } else {
            // For non-video slides, directly show the doubt input
            setShowInput(true);
        }
    };

   if (isPending) return <DashboardLoader />
   if(isError) return <p>Error fetching doubts</p>


   return(
      <>
        <div 
          ref={sidebarRef}
          className={`
            fixed top-0 right-0 h-full z-[10000]
            transition-transform duration-300 ease-in-out
            ${open ? "translate-x-0" : "translate-x-full"}
            w-[35vw] min-w-[400px] max-w-[500px]
            bg-gradient-to-b from-white to-slate-50/30 shadow-2xl border-l border-gray-200/60 backdrop-blur-xl 
            flex flex-col overflow-hidden
          `} 
        >
                      {/* Enhanced Professional Header */}
          <div className="border-b border-gray-200/80 bg-white/95 backdrop-blur-md p-6 flex-shrink-0">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg">
                            <ChatText size={20} className="text-white" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">Doubt Resolution</h1>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {activeItem?.source_type === "VIDEO" ? "Video Timestamp Support" : "General Support"}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={closeSidebar}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all duration-200 hover:scale-105 group"
                    >
                        <X size={18} className="text-gray-600 group-hover:text-gray-800" />
                    </button>
                              </div>
          </div>

          {/* Enhanced Content Area */}
          <div className="flex flex-col flex-1 overflow-hidden bg-gradient-to-b from-white to-slate-50/30">
                <Tabs defaultValue="ALL" onValueChange={(value) => { handleTabChange(value) }} className="flex flex-col h-full">
                    {/* Professional Tab Design */}
                    <div className="px-6 pt-4 pb-2 bg-white/80 backdrop-blur-sm border-b border-gray-100">
                        <TabsList className="w-full bg-gray-50/80 backdrop-blur-sm p-1 rounded-xl border border-gray-200/60">
                            <TabsTrigger 
                                value="ALL" 
                                className="flex-1 flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary-600 text-gray-600 font-medium rounded-lg transition-all duration-200 py-2.5"
                            >
                                <ChatText size={16} />
                                <span className="hidden sm:inline">All Doubts</span>
                                <span className="sm:hidden">All</span>
                            </TabsTrigger>
                            <TabsTrigger 
                                value="RESOLVED" 
                                className="flex-1 flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-green-600 text-gray-600 font-medium rounded-lg transition-all duration-200 py-2.5"
                            >
                                <CheckCircle size={16} />
                                <span className="hidden sm:inline">Resolved</span>
                                <span className="sm:hidden">Done</span>
                            </TabsTrigger>
                            <TabsTrigger 
                                value="UNRESOLVED" 
                                className="flex-1 flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-amber-600 text-gray-600 font-medium rounded-lg transition-all duration-200 py-2.5"
                            >
                                <Clock size={16} />
                                <span className="hidden sm:inline">Pending</span>
                                <span className="sm:hidden">Wait</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    
                    {/* Enhanced Tab Content */}
                    <TabsContent value="ALL" className="flex-1 overflow-y-auto px-6 py-4 data-[state=inactive]:hidden">
                        <DoubtList allDoubts={allDoubts} isLoading={isPending || isLoading} lastDoubtElementRef={lastDoubtElementRef} filter={filter} refetch={refetch} isFetchingNextPage={isFetchingNextPage} status="ALL" />
                    </TabsContent>
                    <TabsContent value="RESOLVED" className="flex-1 overflow-y-auto px-6 py-4 data-[state=inactive]:hidden">
                        <DoubtList allDoubts={allDoubts} isLoading={isPending || isLoading} lastDoubtElementRef={lastDoubtElementRef} filter={filter} refetch={refetch} isFetchingNextPage={isFetchingNextPage} status="RESOLVED" />
                    </TabsContent>
                    <TabsContent value="UNRESOLVED" className="flex-1 overflow-y-auto px-6 py-4 data-[state=inactive]:hidden">
                        <DoubtList allDoubts={allDoubts} isLoading={isPending || isLoading} lastDoubtElementRef={lastDoubtElementRef} filter={filter} refetch={refetch} isFetchingNextPage={isFetchingNextPage} status="ACTIVE" />
                    </TabsContent>
                              </Tabs>
          </div>

          {/* Enhanced Footer */}
          <div className="border-t border-gray-200/80 bg-white/95 backdrop-blur-md p-6 flex-shrink-0">
                {showInput ? (
                    <div className="flex gap-3 w-full max-h-[40vh]">
                        <div className="flex flex-col gap-3 flex-1 min-h-0">
                            {activeItem?.source_type === "VIDEO" && timestamp !== undefined && formattedTime && (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <TimestampChip
                                        timestamp={timestamp}
                                        formattedTime={formattedTime}
                                        onEdit={handleTimestampEdit}
                                    />
                                </div>
                            )}
                            <div className="flex-1 min-h-0 overflow-hidden">
                                <MainViewQuillEditor
                                    value={doubt}
                                    onChange={setDoubt}
                                    className="w-full min-h-[100px] rounded-xl border border-gray-200 focus-within:border-primary-300 transition-colors"
                                    isDoubtResolution={true}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 items-center justify-end flex-shrink-0">
                            <AddDoubt 
                                doubtText={doubt} 
                                refetch={refetch} 
                                setDoubt={setDoubt} 
                                setShowInput={setShowInput}
                                timestamp={timestamp}
                                formattedTime={formattedTime}
                            />
                            <button 
                                onClick={() => setShowInput(false)}
                                className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all duration-200 hover:scale-105 group"
                            >
                                <X size={18} className="text-gray-600 group-hover:text-gray-800" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <MyButton 
                        scale="large" 
                        onClick={handleAskDoubtClick}
                        className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] flex items-center gap-3 justify-center py-4 font-semibold"
                    >
                        <Plus size={20} />
                        Ask a Doubt
                    
                    </MyButton>
                )}
            </div>
          </div>
        
        {/* Backdrop */}
        {open && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9999] transition-opacity duration-300"
            onClick={closeSidebar}
          />
        )}

        {activeItem?.source_type === "VIDEO" && (
            <TimestampDialog
                open={showTimestampDialog}
                onOpenChange={setShowTimestampDialog}
                onTimestampSet={handleTimestampSet}
                initialTimestamp={timestamp}
            />
        )}
      </>
   )
}