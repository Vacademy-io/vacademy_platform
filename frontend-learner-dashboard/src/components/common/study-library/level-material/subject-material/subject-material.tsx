import { EmptySubjectMaterial } from "@/assets/svgs";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect, useState } from "react";
import { SubjectCard } from "./subject-card";
import { useSidebar } from "@/components/ui/sidebar";
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";
import { PullToRefreshWrapper } from "@/components/design-system/pull-to-refresh";
import { fetchStudyLibraryDetails } from "@/services/study-library/getStudyLibraryDetails";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TabType, tabs } from "./-constants/constant";
import {
  CaretDown,
  CaretRight,
  ArrowSquareOut,
  Folder,
  FileText,
  PresentationChart,
} from "phosphor-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { fetchModulesWithChapters } from "@/services/study-library/getModulesWithChapters";
import { SubjectType } from "@/stores/study-library/use-study-library-store";
import { useMutation } from "@tanstack/react-query";
import {
  fetchSlidesByChapterId,
  Slide,
} from "@/hooks/study-library/use-slides";
import { getIcon } from "./module-material/chapter-material/slide-material/chapter-sidebar-slides";
import { useRouter } from '@tanstack/react-router';

export interface Chapter {
  id: string;
  chapter_name: string;
  status: string;
  description: string;
  file_id: string | null;
  chapter_order: number;
}
export interface ChapterMetadata {
  chapter: Chapter;
  slides_count: {
    video_count: number;
    pdf_count: number;
    doc_count: number;
    unknown_count: number;
  };
  chapter_in_package_sessions: string[];
}
export interface Module {
  id: string;
  module_name: string;
  status: string;
  description: string;
  thumbnail_id: string;
}
export interface ModuleWithChapters {
  module: Module;
  chapters: Chapter[];
}
export type SubjectModulesMap = { [subjectId: string]: ModuleWithChapters[] };

export const SubjectMaterial = () => {
  const router = useRouter();
  const { setNavHeading } = useNavHeadingStore();
  const { open } = useSidebar();
  const { studyLibraryData, setStudyLibraryData } = useStudyLibraryStore();
  const [selectedTab, setSelectedTab] = useState<string>(TabType.OUTLINE);
  const handleTabChange = (value: string) => setSelectedTab(value);
  const [subjectModulesMap, setSubjectModulesMap] = useState<SubjectModulesMap>(
    {}
  );
  const [slidesMap, setSlidesMap] = useState<Record<string, Slide[]>>({});

  const getSlidesWithChapterId = async (chapterId: string) => {
    // Avoid duplicate fetch
    if (slidesMap[chapterId]) return;

    try {
      const slides = await fetchSlidesByChapterId(chapterId);
      setSlidesMap((prev) => ({ ...prev, [chapterId]: slides }));
    } catch (err) {
      console.error("err");
    }
  };

  const useModulesMutation = () => {
    return useMutation({
      mutationFn: async ({
        subjects: currentSubjects,
      }: {
        subjects: SubjectType[];
      }) => {
        const packageSessionId = await getPackageSessionId();

        const results = await Promise.all(
          currentSubjects.map(async (subject) => {
            const res = await fetchModulesWithChapters(
              subject.id,
              packageSessionId
            );
            return { subjectId: subject.id, modules: res };
          })
        );

        const modulesMap: SubjectModulesMap = {};
        results.forEach(({ subjectId, modules }) => {
          modulesMap[subjectId] = modules;
        });

        return modulesMap;
      },
    });
  };

  const { mutateAsync: fetchModules } = useModulesMutation();
  const navigateTo = (pathname: string, searchParamsObj: Record<string, string | undefined>) =>
        router.navigate({ to: pathname, search: searchParamsObj });
  const handleSubjectNavigation = (subjectId: string) =>
    navigateTo(`${router.state.location.pathname}/modules`, {
      subjectId,
    });
  const handleModuleNavigation = (subjectId: string, moduleId: string) =>
    navigateTo(`${router.state.location.pathname}/modules/chapters`, {
      subjectId,
      moduleId,
    });
  const handleChapterNavigation = (
    subjectId: string,
    moduleId: string,
    chapterId: string
  ) =>
    navigateTo(`${router.state.location.pathname}/modules/chapters/slides`, {
      subjectId,
      moduleId,
      chapterId,
    });
  const handleSlideNavigation = (
    subjectId: string,
    moduleId: string,
    chapterId: string,
    slideId: string
  ) => {
    console.log(slideId);
    navigateTo(`${router.state.location.pathname}/modules/chapters/slides`, {
      subjectId,
      moduleId,
      chapterId,
      slideId,
    });
  };

  useEffect(() => {
    const loadModules = async () => {
      if (studyLibraryData) {
        try {
          const modulesMap = await fetchModules({
            subjects: studyLibraryData,
          });
          setSubjectModulesMap(modulesMap);
        } catch (error) {
          console.error("Failed to fetch modules:", error);
          setSubjectModulesMap({});
        }
      } else {
        setSubjectModulesMap({});
      }
    };
    loadModules();
  }, [studyLibraryData, fetchModules]);

  useEffect(() => {
    setNavHeading(
      <div className="flex items-center gap-2">
        <div>Subjects</div>
      </div>
    );
  }, []);

  const refreshData = async () => {
    const PackageSessionId = await getPackageSessionId();
    const data = await fetchStudyLibraryDetails(PackageSessionId);
    setStudyLibraryData(data);
  };

  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());

  const toggleOpenState = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    setter((prev) => {
      const u = new Set(prev);
      u.has(id) ? u.delete(id) : u.add(id);
      return u;
    });
  };
  const toggleSubject = (id: string) => toggleOpenState(id, setOpenSubjects);
  const toggleModule = (id: string) => toggleOpenState(id, setOpenModules);
  const toggleChapter = (id: string) => toggleOpenState(id, setOpenChapters);

  const tabContent: Record<TabType, React.ReactNode> = {
    [TabType.OUTLINE]: (
      <div className="space-y-3">
        <div className="max-w-2xl space-y-2">
          {studyLibraryData?.map((subject, idx) => {
            const isSubjectOpen = openSubjects.has(subject.id);
            const baseIndent = "pl-[calc(18px+0.5rem+18px+0.5rem)]";
            const subjectContentIndent = `${baseIndent} pl-[1.5rem]`;

            return (
              <Collapsible
                key={subject.id}
                open={isSubjectOpen}
                onOpenChange={() => toggleSubject(subject.id)}
              >
                <CollapsibleTrigger className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm font-semibold text-gray-700 transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-1">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {isSubjectOpen ? (
                      <CaretDown
                        size={18}
                        weight="bold"
                        className="shrink-0 text-gray-500"
                      />
                    ) : (
                      <CaretRight
                        size={18}
                        weight="bold"
                        className="shrink-0 text-gray-500"
                      />
                    )}
                    <Folder size={18} className="text-primary shrink-0" />
                    <span className="w-6 shrink-0 text-center font-mono text-xs text-gray-500">
                      S{idx + 1}
                    </span>
                    <span className="truncate" title={subject.subject_name}>
                      {subject.subject_name}
                    </span>
                  </div>
                  <ArrowSquareOut
                    size={18}
                    className="hover:text-primary ml-1.5 shrink-0 cursor-pointer text-gray-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubjectNavigation(subject.id);
                    }}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={`pb-0.5 pt-1 ${subjectContentIndent}`}
                >
                  <div className="space-y-1 border-l border-gray-200 pl-2.5">
                    {(subjectModulesMap[subject.id] ?? []).map(
                      (mod, modIdx) => {
                        const isModuleOpen = openModules.has(mod.module.id);
                        const moduleContentIndent = `pl-[calc(16px+0.5rem+16px+0.5rem+1.5rem)]`;
                        return (
                          <Collapsible
                            key={mod.module.id}
                            open={isModuleOpen}
                            onOpenChange={() => toggleModule(mod.module.id)}
                          >
                            <CollapsibleTrigger className="flex w-full items-center rounded-md px-2 py-1 text-left text-xs font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-1">
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                {isModuleOpen ? (
                                  <CaretDown
                                    size={16}
                                    className="shrink-0 text-gray-500"
                                  />
                                ) : (
                                  <CaretRight
                                    size={16}
                                    className="shrink-0 text-gray-500"
                                  />
                                )}
                                <FileText
                                  size={16}
                                  className="shrink-0 text-blue-600"
                                />
                                <span className="w-6 shrink-0 text-center font-mono text-xs text-gray-500">
                                  M{modIdx + 1}
                                </span>
                                <span
                                  className="truncate"
                                  title={mod.module.module_name}
                                >
                                  {mod.module.module_name}
                                </span>
                              </div>
                              <ArrowSquareOut
                                size={16}
                                className="hover:text-primary ml-1.5 shrink-0 cursor-pointer text-gray-400"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleModuleNavigation(subject.id , mod.module.id)
                                }}
                              />
                            </CollapsibleTrigger>

                            <CollapsibleContent
                              className={`py-0.5 ${moduleContentIndent}`}
                            >
                              <div className="space-y-0.5 border-l border-gray-200 pl-2">
                                {(mod.chapters ?? []).map((ch, chIdx) => {
                                  const isChapterOpen = openChapters.has(ch.id);

                                  return (
                                    <Collapsible
                                      key={ch.id}
                                      open={isChapterOpen}
                                      onOpenChange={() => {
                                        toggleChapter(ch.id);
                                        getSlidesWithChapterId(ch.id);
                                      }}
                                    >
                                      <CollapsibleTrigger className="flex w-full items-center rounded-md px-1.5 py-0.5 text-left text-xs text-gray-600 transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:ring-offset-1">
                                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                          {isChapterOpen ? (
                                            <CaretDown
                                              size={14}
                                              className="shrink-0 text-gray-500"
                                            />
                                          ) : (
                                            <CaretRight
                                              size={14}
                                              className="shrink-0 text-gray-500"
                                            />
                                          )}
                                          <PresentationChart
                                            size={14}
                                            className="shrink-0 text-green-600"
                                          />
                                          <span className="text-2xs w-5 shrink-0 text-center font-mono text-gray-500">
                                            C{chIdx + 1}
                                          </span>
                                          <span
                                            className="truncate"
                                            title={ch.chapter_name}
                                          >
                                            {ch.chapter_name}
                                          </span>
                                        </div>
                                        <ArrowSquareOut
                                          size={14}
                                          className="hover:text-primary ml-1 shrink-0 cursor-pointer text-gray-400"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleChapterNavigation(subject.id , mod.module.id , ch.id)
                                          }}
                                        />
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <div className="space-y-px ml-6 border-l border-gray-200 py-1 pl-1.5">
                                          {(slidesMap[ch.id] ?? []).length ===
                                          0 ? (
                                            <div className="text-xs px-1 py-0.5 text-gray-400">
                                              No slides in this chapter.
                                            </div>
                                          ) : (
                                            (slidesMap[ch.id] ?? []).map(
                                              (slide, sIdx) => (
                                                <div
                                                  key={slide.id}
                                                  className="flex cursor-pointer items-center gap-1 px-1 py-px text-xs text-gray-500"
                                                  onClick={() => {
                                                    handleSlideNavigation(
                                                      subject.id,
                                                      mod.module.id,
                                                      ch.id,
                                                      slide.id
                                                    );
                                                  }}
                                                >
                                                  <span className="w-5 shrink-0 text-center font-mono text-gray-400">
                                                    S{sIdx + 1}
                                                  </span>
                                                  {getIcon(slide.source_type, "3")}
                                                  <span
                                                    className="truncate"
                                                    title={slide.title}
                                                  >
                                                    {slide.title}
                                                  </span>
                                                </div>
                                              )
                                            )
                                          )}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      }
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>
    ),
    [TabType.SUBJECTS]: (
      <div className="w-full flex flex-col items-center justify-center">
        {!studyLibraryData?.length ? (
          <div className="flex w-full h-[70vh] flex-col items-center justify-center gap-8 rounded-lg">
            <EmptySubjectMaterial />
            <div>No subjects have been added yet.</div>
          </div>
        ) : (
          <div
            className={`grid grid-cols-2 ${
              open
                ? "sm:grid-cols-2 md-tablets:grid-cols-3"
                : "sm:grid-cols-3 md-tablets:grid-cols-4"
            } w-full gap-4`}
          >
            {studyLibraryData.map((subject) => (
              <SubjectCard key={subject.id} subject={subject} />
            ))}
          </div>
        )}
      </div>
    ),
    [TabType.TEACHERS]: (
      <div className="rounded-md bg-white p-3 text-sm text-gray-600 shadow-sm">
        Teachers content coming soon.
      </div>
    ),
    [TabType.ASSESSMENT]: (
      <div className="rounded-md bg-white p-3 text-sm text-gray-600 shadow-sm">
        Assessment content coming soon.
      </div>
    ),
    // TODO : add when feature  is available 
    // [TabType.ASSIGNMENT]: (
    //   <div className="rounded-md bg-white p-3 text-sm text-gray-600 shadow-sm">
    //     Assignment content coming soon.
    //   </div>
    // ),
    // [TabType.GRADING]: (
    //   <div className="rounded-md bg-white p-3 text-sm text-gray-600 shadow-sm">
    //     Grading content coming soon.
    //   </div>
    // ),
    // [TabType.ANNOUNCEMENT]: (
    //   <div className="rounded-md bg-white p-3 text-sm text-gray-600 shadow-sm">
    //     Announcement content coming soon.
    //   </div>
    // ),
  };

  return (
    <PullToRefreshWrapper onRefresh={refreshData}>
      <div className="flex size-full flex-col gap-3 rounded-lg bg-gray-100 p-2 text-neutral-700 md:p-3">
        <Tabs
          value={selectedTab}
          onValueChange={handleTabChange}
          className="w-full overflow-scroll"
        >
          <TabsList className="h-auto border-b border-gray-200 bg-transparent p-0">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={`data-[state=active]:text-primary data-[state=active]:border-primary hover:text-primary -mb-px px-2.5 
                                py-1.5 text-xs font-medium transition-all duration-150 
                                hover:bg-gray-50/70 focus-visible:ring-1 focus-visible:ring-primary-300 focus-visible:ring-offset-1
                                data-[state=active]:rounded-t-md data-[state=active]:border-b-2 data-[state=active]:bg-white data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:rounded-t-md`}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent
            key={selectedTab}
            value={selectedTab}
            className="mt-3 rounded-r-md bg-white p-3 shadow-sm"
          >
            {tabContent[selectedTab as TabType]}
          </TabsContent>
        </Tabs>
      </div>
    </PullToRefreshWrapper>
  );
};
