import { MyButton } from "@/components/design-system/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar"
import { X } from "@phosphor-icons/react"
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

const TabsTriggerClass = "w-full data-[state=active]:shadow-none rounded-none rounded-tl-md rounded-tr-md border-white border-l-[1px] border-r-[1px] border-t-[1px] data-[state=active]:border-primary-200 data-[state=active]:text-primary-500 pt-2"

export const DoubtResolutionSidebar = () => {

    const {open, setOpen} = useSidebar();
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
                
                setOpen(false);
            }
        };

        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open, setOpen]);
    
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
        setShowTimestampDialog(true);
    };

    const handleAskDoubtClick = () => {
        setTimestamp(undefined);
        setFormattedTime(undefined);
        setShowTimestampDialog(true);
    };

   if (isPending) return <DashboardLoader />
   if(isError) return <p>Error fetching doubts</p>


   return(
      <>
        <Sidebar ref={sidebarRef} side="right" className={`${open? "w-[35vw]" : "w-0"} bg-white p-4 flex flex-col gap-6 overflow-y-hidden z-[10000]`} >
          <SidebarHeader className="flex items-center justify-between w-full bg-white overflow-y-hidden">
              <div className="flex items-center justify-between bg-white w-full">
                  <h1 className="sm:text-2xl text-lg font-semibold text-primary-500">Doubt Resolution</h1>
                  <X className="hover:cursor-pointer" onClick={()=>setOpen(false)} />
              </div>
          </SidebarHeader>
          <SidebarContent className="flex flex-col gap-4 overflow-y-scroll no-scrollbar bg-white pt-6">
              <Tabs defaultValue="ALL" onValueChange={(value) => { handleTabChange(value) }} className="flex flex-col gap-4">
                  <TabsList className="w-full flex border-b border-neutral-300 p-0 bg-white rounded-none">
                      <TabsTrigger value="ALL" className={TabsTriggerClass}>All</TabsTrigger>
                      <TabsTrigger value="RESOLVED" className={TabsTriggerClass}>Resolved</TabsTrigger>
                      <TabsTrigger value="UNRESOLVED" className={TabsTriggerClass}>Unresolved</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="ALL" className="flex flex-col gap-4 data-[state=inactive]:hidden ">
                      <DoubtList allDoubts={allDoubts} isLoading={isPending || isLoading} lastDoubtElementRef={lastDoubtElementRef} filter={filter} refetch={refetch} isFetchingNextPage={isFetchingNextPage} status="ALL" />
                  </TabsContent>
                  <TabsContent value="RESOLVED" className="flex flex-col gap-4 data-[state=inactive]:hidden ">
                      <DoubtList allDoubts={allDoubts} isLoading={isPending || isLoading} lastDoubtElementRef={lastDoubtElementRef} filter={filter} refetch={refetch} isFetchingNextPage={isFetchingNextPage} status="RESOLVED" />
                  </TabsContent>
                  <TabsContent value="UNRESOLVED" className="flex flex-col gap-4 data-[state=inactive]:hidden ">
                      <DoubtList allDoubts={allDoubts} isLoading={isPending || isLoading} lastDoubtElementRef={lastDoubtElementRef} filter={filter} refetch={refetch} isFetchingNextPage={isFetchingNextPage} status="ACTIVE" />
                  </TabsContent>
              </Tabs>
          </SidebarContent>
          <SidebarFooter className="w-full flex items-center justify-center bg-white sm:py-0">
              {showInput ? (
                  <div className="items-center rounded-md py-3 w-full flex gap-2">
                      <div className="flex flex-col gap-2 w-full">
                          {timestamp !== undefined && formattedTime && (
                              <div className="flex items-center gap-2">
                                  <TimestampChip
                                      timestamp={timestamp}
                                      formattedTime={formattedTime}
                                      onEdit={handleTimestampEdit}
                                  />
                              </div>
                          )}
                          <MainViewQuillEditor
                              value={doubt}
                              onChange={setDoubt}
                              className="w-full sm:mb-10 mb-16 h-[80px] max-sm:h-[50px]"
                          />
                      </div>
                      <div className="flex flex-col items-center gap-3">
                          <AddDoubt 
                              doubtText={doubt} 
                              refetch={refetch} 
                              setDoubt={setDoubt} 
                              setShowInput={setShowInput}
                              timestamp={timestamp}
                              formattedTime={formattedTime}
                          />
                          <MyButton layoutVariant="icon" buttonType="secondary" onClick={()=>setShowInput(false)}>
                              <X />
                          </MyButton>
                      </div>
                  </div>
              ):
              <MyButton scale="large" onClick={handleAskDoubtClick}>Ask Doubt</MyButton>
              }
          </SidebarFooter>
        </Sidebar>
        
        <TimestampDialog
            open={showTimestampDialog}
            onOpenChange={setShowTimestampDialog}
            onTimestampSet={handleTimestampSet}
            initialTimestamp={timestamp}
        />
      </>
   )
}