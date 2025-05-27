import { MyButton } from "@/components/design-system/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar"
import { X } from "@phosphor-icons/react"
import {  useState, useRef, useCallback, useEffect } from "react";
import { Doubt } from "./doubt";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainViewQuillEditor } from "@/components/quill/MainViewQuillEditor";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { DoubtFilter, Doubt as DoubtType } from "../types/get-doubts-type";
import { useGetDoubts } from "../services/GetDoubts";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { AddDoubt } from "./AddDoubt";
const TabsTriggerClass = "w-full data-[state=active]:shadow-none rounded-none rounded-tl-md rounded-tr-md border-white border-l-[1px] border-r-[1px] border-t-[1px] data-[state=active]:border-primary-200 data-[state=active]:text-primary-500 pt-2"

export const DoubtResolutionSidebar = () => {

    const {open, setOpen} = useSidebar();
    const [showInput, setShowInput] = useState<boolean>(false)
    const [doubt, setDoubt] = useState<string>("")
    const {activeItem} = useContentStore();
    const observer = useRef<IntersectionObserver | null>(null);
    
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
    
    const {data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch} = useGetDoubts(filter);

    
    const [allDoubts, setAllDoubts] = useState<DoubtType[]>(data?.pages.flatMap(page => page.content) || []);
    
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

   if (isLoading) return <DashboardLoader />
   if(isError) return <p>Error fetching doubts</p>


   return(
      <Sidebar side="right" className={`${open? "w-[50vw]" : "w-0"} bg-white p-4 flex flex-col gap-6 overflow-y-hidden`} >
        <SidebarHeader className="flex items-center justify-between w-full bg-white overflow-y-hidden">
            <div className="flex items-center justify-between bg-white w-full">
                <h1 className="sm:text-2xl text-lg font-semibold text-primary-500">Doubt Resolution</h1>
                <X className="hover:cursor-pointer" onClick={()=>setOpen(false)} />
            </div>
        </SidebarHeader>
        <SidebarContent className="flex flex-col gap-4 overflow-y-scroll no-scrollbar bg-white pt-6">
            <Tabs defaultValue="ALL" onValueChange={(value) => { handleTabChange(value) }}>
                <TabsList className="w-full flex border-b border-neutral-300 p-0 bg-white rounded-none">
                    <TabsTrigger value="ALL" className={TabsTriggerClass}>All</TabsTrigger>
                    <TabsTrigger value="RESOLVED" className={TabsTriggerClass}>Resolved</TabsTrigger>
                    <TabsTrigger value="UNRESOLVED" className={TabsTriggerClass}>Unresolved</TabsTrigger>
                </TabsList>
                <TabsContent value="ALL" className="flex flex-col gap-4">
                    {isLoading && <DashboardLoader />}
                    {allDoubts.map((doubt, index) => (
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
                    ))}
                    {isFetchingNextPage && <DashboardLoader />}
                </TabsContent>
                <TabsContent value="RESOLVED" className="flex flex-col gap-4">
                {isLoading && <DashboardLoader />}
                    {allDoubts.map((doubt, index) => (
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
                    ))}
                    {isFetchingNextPage && <DashboardLoader />}
                </TabsContent>
                <TabsContent value="UNRESOLVED" className="flex flex-col gap-4">
                {isLoading && <DashboardLoader />}
                    {allDoubts.map((doubt, index) => (
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
                    ))}
                    {isFetchingNextPage && <DashboardLoader />}
                </TabsContent>
            </Tabs>
        </SidebarContent>
        <SidebarFooter className="w-full flex items-center justify-center bg-white sm:py-0">
            {showInput ? (
                <div className=" items-center rounded-md p-3 w-full flex gap-2">
                    <MainViewQuillEditor
                        value={doubt}
                        onChange={setDoubt}
                        className="w-full sm:mb-10 mb-16 h-[80px] max-sm:h-[50px]"
                    />
                    <div className="flex flex-col items-center gap-3">
                        <AddDoubt doubtText={doubt} refetch={refetch} setDoubt={setDoubt} setShowInput={setShowInput} />
                        <MyButton layoutVariant="icon" buttonType="secondary" onClick={()=>setShowInput(false)}>
                            <X />
                        </MyButton>
                    </div>
                </div>
            ):
            <MyButton scale="large" onClick={()=>setShowInput(true)}>Ask Doubt</MyButton>
            }
        </SidebarFooter>
      </Sidebar>
   )
}