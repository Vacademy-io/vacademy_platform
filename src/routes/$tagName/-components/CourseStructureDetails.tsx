import React, { useState, useEffect } from "react";
import { TreeStructure, CaretDown, CaretRight, Folder, FileText, PresentationChart, FolderOpen, FilePdf, FileDoc, Play, Question, ClipboardText, Exam } from "phosphor-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface SubjectType {
  id: string;
  subject_name: string;
  subject_order: number;
  description: string;
}

interface Chapter {
  id: string;
  chapter_name: string;
  chapter_order: number;
  description: string;
  status: string;
  file_id: string | null;
}

interface Module {
  id: string;
  module_name: string;
  module_order: number;
  description: string;
  chapters: Chapter[];
}

interface ModuleWithChapters {
  module: Module;
  chapters: Chapter[];
}

interface SubjectModulesMap {
  [subjectId: string]: ModuleWithChapters[];
}

interface Slide {
  id: string;
  title: string;
  slide_order: number;
  slide_type: string;
  description: string;
  file_id: string | null;
  status: string;
  source_type?: string;
  document_slide?: {
    type: string;
    title: string;
  };
  video_slide?: any;
  question_slide?: any;
  assignment_slide?: any;
  quiz_slide?: any;
}

interface CourseStructureDetailsProps {
  courseDepth: number;
  courseId: string;
  instituteId: string;
  packageSessionId: string;
  levelId?: string; // Add levelId parameter
}

export const CourseStructureDetails: React.FC<CourseStructureDetailsProps> = ({
  courseDepth,
  courseId,
  instituteId,
  packageSessionId,
  levelId,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [studyLibraryData, setStudyLibraryData] = useState<SubjectType[]>([]);
  const [subjectModulesMap, setSubjectModulesMap] = useState<SubjectModulesMap>({});
  const [slidesMap, setSlidesMap] = useState<Record<string, Slide[]>>({});
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());

  // Helper function to check if a name is "default"
  const isDefaultName = (name: string | undefined | null): boolean => {
    return name ? name.toLowerCase() === 'default' : false;
  };

  // Function to get slide icon and color based on slide type
  const getSlideIcon = (slide: Slide) => {
    // Check for video slides first
    if (slide.video_slide) {
      return { Icon: Play, color: "text-red-500", label: "Video" };
    }
    
    // Check for question slides
    if (slide.question_slide) {
      return { Icon: Question, color: "text-blue-500", label: "Question" };
    }
    
    // Check for assignment slides
    if (slide.assignment_slide) {
      return { Icon: ClipboardText, color: "text-orange-500", label: "Assignment" };
    }
    
    // Check for quiz slides
    if (slide.quiz_slide) {
      return { Icon: Exam, color: "text-purple-500", label: "Quiz" };
    }
    
    // Check for document slides
    if (slide.document_slide) {
      const docType = slide.document_slide.type;
      if (docType === "PDF") {
        return { Icon: FilePdf, color: "text-red-600", label: "PDF" };
      } else if (docType === "DOC" || docType === "DOCX") {
        return { Icon: FileDoc, color: "text-blue-600", label: "Document" };
      }
    }
    
    // Default fallback
    return { Icon: PresentationChart, color: "text-gray-500", label: "Slide" };
  };

  // Step 1: Fetch subjects from init-details API
  const fetchSubjectsFromInitDetails = async () => {
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "https://backend-stage.vacademy.io";
      const url = `${baseUrl}/admin-core-service/open/v1/learner-study-library/init-details?packageSessionId=${packageSessionId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("[CourseStructureDetails] Error fetching subjects data:", error);
      throw error;
    }
  };

  // Step 2: Fetch modules for subjectId and packageSessionId
  const fetchModules = async (subjectId: string) => {
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "https://backend-stage.vacademy.io";
      const url = `${baseUrl}/admin-core-service/open/v1/learner-study-library/modules-with-chapters?subjectId=${subjectId}&packageSessionId=${packageSessionId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const modules = await response.json();

      if (Array.isArray(modules) && modules.length > 0) {
        // Debug the structure of modules
      }
      
      return modules || [];
    } catch (error) {
      console.error("[CourseStructureDetails] Error fetching modules for subject", subjectId, ":", error);
      return [];
    }
  };


  // Step 3: Fetch slides for a chapter
  const fetchSlidesForChapter = async (chapterId: string) => {
    if (!chapterId || chapterId === null || chapterId === undefined) {
      return [];
    }

    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "https://backend-stage.vacademy.io";
      const url = `${baseUrl}/admin-core-service/open/v1/learner-study-library/slides?chapterId=${chapterId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const slides = await response.json();

      return slides || [];
    } catch (error) {
      console.error("[CourseStructureDetails] Error fetching slides for chapter", chapterId, ":", error);
      return [];
    }
  };

  // Step 4: Fetch slides for a chapter (lazy loading - only when chapter is expanded)
  const getSlidesWithChapterId = async (chapterId: string) => {
    // Avoid duplicate fetch
    if (slidesMap[chapterId]) return;

    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "https://backend-stage.vacademy.io";
      const slidesUrl = `${baseUrl}/admin-core-service/open/v1/learner-study-library/slides?chapterId=${chapterId}`;
      const response = await fetch(slidesUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const slides = await response.json();

      const filteredSlides = Array.isArray(slides) ? slides : [];
      setSlidesMap((prev) => ({ ...prev, [chapterId]: filteredSlides }));
    } catch (err) {
      console.error("[CourseStructureDetails] Error fetching slides for chapter", chapterId, ":", err);
    }
  };

  // Load data based on course depth following proper API flow: init → modules → chapters → slides
  useEffect(() => {
    const loadData = async () => {
      if (!packageSessionId || !instituteId) return;

      try {
        setIsLoading(true);

        // Step 1: Fetch subjects from init-details API
        const subjectsData = await fetchSubjectsFromInitDetails();

        // Transform subjects data to SubjectType format
        const subjects: SubjectType[] = [];
        
        if (Array.isArray(subjectsData)) {
          subjectsData.forEach((subject: any, index: number) => {
            if (subject.id) {
              const transformedSubject: SubjectType = {
                id: subject.id,
                subject_name: subject.subject_name || `Subject ${index + 1}`,
                subject_order: subject.subject_order || index,
                description: subject.description || '',
              };
              subjects.push(transformedSubject);
            }
          });
        }
        setStudyLibraryData(subjects);

        // Step 2: Fetch modules for each subject
        const modulesMap: SubjectModulesMap = {};
        
        if (subjects.length === 0) {
          // No subjects found - API calls will not proceed
        } else {
          for (const subject of subjects) {
            const modules = await fetchModules(subject.id);
            
            // Step 3: Process modules and fetch slides for each chapter
            const modulesWithChapters: ModuleWithChapters[] = [];
            for (const moduleItem of modules) {
              // The API response has structure: { module: {...}, chapters: [...] }
              const moduleData = moduleItem.module;
              const chapters = moduleItem.chapters || [];

              // Fetch slides for each chapter
              const chaptersWithSlides = [];
              for (const chapter of chapters) {
                const slides = await fetchSlidesForChapter(chapter.id);
                
                chaptersWithSlides.push({
                  ...chapter,
                  slides: slides || []
                });
              }
              
              modulesWithChapters.push({
                module: moduleData, // Use the actual module data, not the wrapper
                chapters: chaptersWithSlides
              });
            }
            
            modulesMap[subject.id] = modulesWithChapters;
          }
        }
        
        setSubjectModulesMap(modulesMap);
        
        // Debug: Log the modulesMap structure
        console.log("[CourseStructureDetails] Final modulesMap:", modulesMap);
        Object.keys(modulesMap).forEach(subjectId => {
          console.log(`[CourseStructureDetails] Subject ${subjectId} has ${modulesMap[subjectId].length} modules:`);
          modulesMap[subjectId].forEach((moduleWithChapters, index) => {
            console.log(`[CourseStructureDetails] Module ${index}:`, {
              id: moduleWithChapters.module?.id,
              name: moduleWithChapters.module?.module_name,
              description: moduleWithChapters.module?.description,
              chaptersCount: moduleWithChapters.chapters?.length || 0
            });
          });
        });
        
        // Debug: Count total chapters and modules
        let totalChapters = 0;
        let totalModules = 0;
        Object.values(modulesMap).forEach((modules) => {
          totalModules += modules.length;
          modules.forEach((module) => {
            totalChapters += module.chapters?.length || 0;
          });
        });
        console.log("[CourseStructureDetails] Total modules found:", totalModules);
        console.log("[CourseStructureDetails] Total chapters found:", totalChapters);

        // Step 3: Set up open states based on course depth
        if (courseDepth === 2) {
          // Depth 2: Only show slides - preload ALL slides immediately
          const newSlidesMap: Record<string, Slide[]> = {};
          const slideLoadPromises: Promise<void>[] = [];

          Object.values(modulesMap).forEach((modules) => {
            modules.forEach((mod) => {
              mod.chapters.forEach((ch) => {
                // Fetch slides directly and store in newSlidesMap
                const slidePromise = fetchSlidesForChapter(ch.id).then((slides) => {
                  newSlidesMap[ch.id] = slides;
                });
                slideLoadPromises.push(slidePromise);
              });
            });
          });

          // Wait for all slides to load before updating state
          await Promise.all(slideLoadPromises);
          setSlidesMap(newSlidesMap);
        } else if (courseDepth === 3) {
          // Depth 3: Show chapters and slides - preload slides same as depth 2
          const newSlidesMap: Record<string, Slide[]> = {};
          const slideLoadPromises: Promise<void>[] = [];

          Object.values(modulesMap).forEach((modules) => {
            modules.forEach((mod) => {
              mod.chapters.forEach((ch) => {
                const slidePromise = fetchSlidesForChapter(ch.id).then((slides) => {
                  newSlidesMap[ch.id] = slides;
                });
                slideLoadPromises.push(slidePromise);
              });
            });
          });

          await Promise.all(slideLoadPromises);
          setSlidesMap(newSlidesMap);
        }
      } catch (error) {
        console.error("[CourseStructureDetails] Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [courseDepth, packageSessionId, instituteId]);

  const toggleOpenState = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    setter((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Toggle functions with lazy loading (like /courses route)
  const toggleSubject = (subjectId: string) => {
    toggleOpenState(subjectId, setOpenSubjects);
  };

  const toggleModule = (moduleId: string) => {
    toggleOpenState(moduleId, setOpenModules);
  };

  const toggleChapter = (chapterId: string) => {
    const isCurrentlyOpen = openChapters.has(chapterId);
    toggleOpenState(chapterId, setOpenChapters);
    // Load slides when chapter is expanded (if it wasn't open before)
    if (!isCurrentlyOpen) {
      getSlidesWithChapterId(chapterId);
    }
  };

  const expandAll = () => {
    const allSubjectIds = new Set(studyLibraryData.map(s => s.id));
    const allModuleIds = new Set<string>();
    const allChapterIds = new Set<string>();

    // Collect all module and chapter IDs
    Object.values(subjectModulesMap).forEach(modules => {
      modules.forEach(module => {
        allModuleIds.add(module.module.id);
        module.chapters.forEach(chapter => {
          allChapterIds.add(chapter.id);
        });
      });
    });

    setOpenSubjects(allSubjectIds);
    setOpenModules(allModuleIds);
    setOpenChapters(allChapterIds);
  };

  const collapseAll = () => {
    setOpenSubjects(new Set());
    setOpenModules(new Set());
    setOpenChapters(new Set());
  };

  const isAllExpanded = 
    studyLibraryData.every(subject => openSubjects.has(subject.id)) &&
    Object.values(subjectModulesMap).every(modules => 
      modules.every(module => 
        openModules.has(module.module.id) &&
        module.chapters.every(chapter => 
          openChapters.has(chapter.id)
        )
      )
    );

  const renderChapters = (module: ModuleWithChapters) => {
    const chapters = module.chapters || [];
    
    // Depth 5: Filter out "default" chapters (this function is used by depth 5's renderModules)
    const filteredChapters = chapters.filter(
      (chapter) => !isDefaultName(chapter.chapter_name)
    );
    
    if (filteredChapters.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No chapters available for this module.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredChapters.map((chapter, index) => (
          <Collapsible
            key={`${chapter.id}-${index}`}
            open={openChapters.has(chapter.id)}
            onOpenChange={() => toggleChapter(chapter.id)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg overflow-hidden"
              >
                <FileText size={16} className="mr-2 text-green-500 flex-shrink-0" />
                <span className="text-sm font-medium break-words truncate flex-1 min-w-0">{chapter.chapter_name || 'Unnamed Chapter'}</span>
                <div className="flex-shrink-0 ml-2">
                  {openChapters.has(chapter.id) ? (
                    <CaretDown size={16} />
                  ) : (
                    <CaretRight size={16} />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-4 mt-2">
              {renderSlides(chapter.id)}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  };

  const renderSlides = (chapterId: string) => {
    const slides = slidesMap[chapterId] || [];
    
    // If slides haven't been fetched yet, show loading state
    if (!slidesMap[chapterId]) {
      return (
        <div className="text-sm text-gray-500 italic">
          Loading slides...
        </div>
      );
    }
    
    if (slides.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No slides available for this chapter.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {slides.map((slide, index) => {
          const { Icon, color, label } = getSlideIcon(slide);
          return (
            <div
              key={`${slide.id}-${index}`}
              className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 overflow-hidden"
            >
              <Icon size={16} className={`flex-shrink-0 ${color}`} />
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium break-words truncate">{slide.title}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">({label})</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderModules = (subjectId: string) => {
    const modules = subjectModulesMap[subjectId] || [];

    // Depth 5: Filter out "default" modules
    const filteredModules = modules.filter(
      (moduleWithChapters) => !isDefaultName(moduleWithChapters.module?.module_name)
    );
    
    if (filteredModules.length === 0) return null;

    return (
      <div className="space-y-2">
        {filteredModules.map((moduleWithChapters, index) => (
          <Collapsible
            key={`${moduleWithChapters.module?.id}-${index}`}
            open={openModules.has(moduleWithChapters.module?.id)}
            onOpenChange={() => toggleOpenState(moduleWithChapters.module?.id, setOpenModules)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg overflow-hidden"
              >
                <Folder size={16} className="mr-2 text-orange-500 flex-shrink-0" />
                <span className="text-sm font-medium break-words truncate flex-1 min-w-0">{moduleWithChapters.module?.module_name || 'Unnamed Module'}</span>
                <div className="flex-shrink-0 ml-2">
                  {openModules.has(moduleWithChapters.module?.id) ? (
                    <CaretDown size={16} />
                  ) : (
                    <CaretRight size={16} />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-4 mt-2">
              {moduleWithChapters.module?.description && moduleWithChapters.module.description.trim() !== '' && (
                <div className="p-2 bg-gray-50 rounded text-sm text-gray-600 mb-2">
                  {moduleWithChapters.module.description}
                </div>
              )}
              {renderChapters(moduleWithChapters)}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  };

  // Render slides only for depth 2 (skip "default" chapters - show slides directly)
  const renderSlidesForDepth2 = () => {
    const result: JSX.Element[] = [];

    Object.values(subjectModulesMap).forEach((modules, subjectIndex) => {
      modules.forEach((moduleWithChapters, moduleIndex) => {
        moduleWithChapters.chapters.forEach((chapter, chapterIndex) => {
          const isChapterDefault = isDefaultName(chapter.chapter_name);

          if (!isChapterDefault) {
            // Chapter is not default, show it with slides
            result.push(
              <Collapsible
                key={`${chapter.id}-${chapterIndex}`}
                open={openChapters.has(chapter.id)}
                onOpenChange={() => toggleChapter(chapter.id)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <FileText size={16} className="mr-2 text-green-500 flex-shrink-0" />
                    <span className="text-sm font-medium break-words truncate flex-1 min-w-0">{chapter.chapter_name || 'Unnamed Chapter'}</span>
                    <div className="flex-shrink-0 ml-2">
                      {openChapters.has(chapter.id) ? (
                        <CaretDown size={16} />
                      ) : (
                        <CaretRight size={16} />
                      )}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-4 mt-2">
                  {renderSlides(chapter.id)}
                </CollapsibleContent>
              </Collapsible>
            );
          } else {
            // Chapter is "default", render slides directly
            const slides = slidesMap[chapter.id] || [];
            
            if (slides.length === 0) {
              console.warn(`[CourseStructureDetails] [DEPTH-2] No slides found in slidesMap for chapter ${chapter.id}, this might be loading issue`);
            }
            
            slides.forEach((slide, slideIndex) => {
              const { Icon, color, label } = getSlideIcon(slide);
              result.push(
                <div
                  key={`${slide.id}-${slideIndex}`}
                  className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 overflow-hidden"
                >
                  <Icon size={16} className={`flex-shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium break-words truncate">{slide.title}</span>
                      <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">({label})</span>
                    </div>
                  </div>
                </div>
              );
            });
          }
        });
      });
    });

    console.log("[CourseStructureDetails] [DEPTH-2] Total items rendered:", result.length);

    if (result.length === 0) {
      console.log("[CourseStructureDetails] [DEPTH-2] No items to render! Checking data:");
      console.log("[CourseStructureDetails] [DEPTH-2] - Subjects:", Object.keys(subjectModulesMap).length);
      console.log("[CourseStructureDetails] [DEPTH-2] - SlidesMap has data:", Object.keys(slidesMap).length > 0);
      return (
        <div className="text-sm text-gray-500 italic">
          Loading course content...
        </div>
      );
    }

    return <div className="space-y-2">{result}</div>;
  };

  // Render all chapters for depth 3 (skip "default" labels, show content directly)
  const renderAllChaptersForDepth3 = () => {
    const result: JSX.Element[] = [];

    Object.values(subjectModulesMap).forEach((modules) => {
      modules.forEach((moduleWithChapters) => {
        const chapters = moduleWithChapters.chapters || [];

        chapters.forEach((chapter, chapterIndex) => {
          const isChapterDefault = isDefaultName(chapter.chapter_name);

          if (!isChapterDefault) {
            // Chapter is not default, show it
            result.push(
              <Collapsible
                key={`${chapter.id}-${chapterIndex}`}
                open={openChapters.has(chapter.id)}
                onOpenChange={() => toggleChapter(chapter.id)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <FileText size={16} className="mr-2 text-green-500 flex-shrink-0" />
                    <span className="text-sm font-medium break-words truncate flex-1 min-w-0">{chapter.chapter_name || 'Unnamed Chapter'}</span>
                    <div className="flex-shrink-0 ml-2">
                      {openChapters.has(chapter.id) ? (
                        <CaretDown size={16} />
                      ) : (
                        <CaretRight size={16} />
                      )}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-4 mt-2">
                  {renderSlides(chapter.id)}
                </CollapsibleContent>
              </Collapsible>
            );
          } else {
            // Chapter is "default", render slides directly from chapter.slides
            const slides = (chapter as any).slides || [];
            
            slides.forEach((slide: Slide, slideIndex: number) => {
              const { Icon, color, label } = getSlideIcon(slide);
              result.push(
                <div
                  key={`${slide.id}-${slideIndex}`}
                  className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 overflow-hidden"
                >
                  <Icon size={16} className={`flex-shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium break-words truncate">{slide.title}</span>
                      <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">({label})</span>
                    </div>
                  </div>
                </div>
              );
            });
          }
        });
      });
    });

    if (result.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No content available for this course.
        </div>
      );
    }

    return <div className="space-y-2">{result}</div>;
  };

  // Render all modules for depth 4 (skip "default" labels, show content directly)
  const renderModulesForDepth4 = () => {
    const result: JSX.Element[] = [];

    Object.values(subjectModulesMap).forEach((modules) => {
      modules.forEach((moduleWithChapters, moduleIndex) => {
        const isModuleDefault = isDefaultName(moduleWithChapters.module?.module_name);

        if (!isModuleDefault) {
          // Module is not default, show it with chapters
          result.push(
            <Collapsible
              key={`${moduleWithChapters.module?.id}-${moduleIndex}`}
              open={openModules.has(moduleWithChapters.module?.id)}
              onOpenChange={() => toggleModule(moduleWithChapters.module?.id)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg overflow-hidden"
                >
                  <Folder size={16} className="mr-2 text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-medium break-words truncate flex-1 min-w-0">{moduleWithChapters.module?.module_name || 'Unnamed Module'}</span>
                  <div className="flex-shrink-0 ml-2">
                    {openModules.has(moduleWithChapters.module?.id) ? (
                      <CaretDown size={16} />
                    ) : (
                      <CaretRight size={16} />
                    )}
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-4 mt-2">
                {moduleWithChapters.module?.description && moduleWithChapters.module.description.trim() !== '' && (
                  <div className="p-2 bg-gray-50 rounded text-sm text-gray-600 mb-2">
                    {moduleWithChapters.module.description}
                  </div>
                )}
                {/* Depth 4: Filter chapters within modules */}
                {(() => {
                  const filteredChapters = moduleWithChapters.chapters.filter(
                    (chapter) => !isDefaultName(chapter.chapter_name)
                  );
                  if (filteredChapters.length === 0) {
                    return (
                      <div className="text-sm text-gray-500 italic">
                        No chapters available for this module.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {filteredChapters.map((chapter, index) => (
                        <Collapsible
                          key={`${chapter.id}-${index}`}
                          open={openChapters.has(chapter.id)}
                          onOpenChange={() => toggleChapter(chapter.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg overflow-hidden"
                            >
                              <FileText size={16} className="mr-2 text-green-500 flex-shrink-0" />
                              <span className="text-sm font-medium break-words truncate flex-1 min-w-0">{chapter.chapter_name || 'Unnamed Chapter'}</span>
                              <div className="flex-shrink-0 ml-2">
                                {openChapters.has(chapter.id) ? (
                                  <CaretDown size={16} />
                                ) : (
                                  <CaretRight size={16} />
                                )}
                              </div>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="ml-4 mt-2">
                            {renderSlides(chapter.id)}
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  );
                })()}
              </CollapsibleContent>
            </Collapsible>
          );
        } else {
          // Module is "default", render chapters directly
          const chapters = moduleWithChapters.chapters || [];
          chapters.forEach((chapter, chapterIndex) => {
            const isChapterDefault = isDefaultName(chapter.chapter_name);

            if (!isChapterDefault) {
              // Chapter is not default, show it
              result.push(
                <Collapsible
                  key={`${chapter.id}-${chapterIndex}`}
                  open={openChapters.has(chapter.id)}
                  onOpenChange={() => toggleChapter(chapter.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <FileText size={16} className="mr-2 text-green-500 flex-shrink-0" />
                      <span className="text-sm font-medium break-words truncate flex-1 min-w-0">{chapter.chapter_name || 'Unnamed Chapter'}</span>
                      <div className="flex-shrink-0 ml-2">
                        {openChapters.has(chapter.id) ? (
                          <CaretDown size={16} />
                        ) : (
                          <CaretRight size={16} />
                        )}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="ml-4 mt-2">
                    {renderSlides(chapter.id)}
                  </CollapsibleContent>
                </Collapsible>
              );
            } else {
              // Chapter is "default", render slides directly from chapter.slides
              const slides = (chapter as any).slides || [];
              
              slides.forEach((slide: Slide, slideIndex: number) => {
                const { Icon, color, label } = getSlideIcon(slide);
                result.push(
                  <div
                    key={`${slide.id}-${slideIndex}`}
                    className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 overflow-hidden"
                  >
                    <Icon size={16} className={`flex-shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium break-words truncate">{slide.title}</span>
                        <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">({label})</span>
                      </div>
                    </div>
                  </div>
                );
              });
            }
          });
        }
      });
    });

    if (result.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No content available for this course.
        </div>
      );
    }

    return <div className="space-y-2">{result}</div>;
  };

  // Render all subjects for depth 5 (skip "default" labels, show content directly)
  const renderSubjectsForDepth5 = () => {
    const result: JSX.Element[] = [];

    studyLibraryData.forEach((subject, subjectIndex) => {
      const modules = subjectModulesMap[subject.id] || [];
      const isSubjectDefault = isDefaultName(subject.subject_name);

      // If subject is not default, show it with its modules
      if (!isSubjectDefault) {
        result.push(
          <Collapsible
            key={`${subject.id}-${subjectIndex}`}
            open={openSubjects.has(subject.id)}
            onOpenChange={() => toggleSubject(subject.id)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start p-3 h-auto text-left border border-gray-200 rounded-lg overflow-hidden"
              >
                <FolderOpen size={18} className="mr-3 text-purple-500 flex-shrink-0" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="font-medium text-gray-900 break-words truncate">{subject.subject_name}</div>
                  <div className="text-sm text-gray-500 break-words truncate">{subject.description}</div>
                </div>
                <div className="flex-shrink-0 ml-2">
                  {openSubjects.has(subject.id) ? (
                    <CaretDown size={16} />
                  ) : (
                    <CaretRight size={16} />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-4 mt-2">
              {renderModules(subject.id)}
            </CollapsibleContent>
          </Collapsible>
        );
      } else {
        // Subject is "default", so render modules directly without subject wrapper
        modules.forEach((moduleWithChapters, moduleIndex) => {
          const isModuleDefault = isDefaultName(moduleWithChapters.module?.module_name);

          if (!isModuleDefault) {
            // Module is not default, show it
            result.push(
              <Collapsible
                key={`${moduleWithChapters.module?.id}-${moduleIndex}`}
                open={openModules.has(moduleWithChapters.module?.id)}
                onOpenChange={() => toggleOpenState(moduleWithChapters.module?.id, setOpenModules)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <Folder size={16} className="mr-2 text-orange-500 flex-shrink-0" />
                    <span className="text-sm font-medium break-words truncate flex-1 min-w-0">{moduleWithChapters.module?.module_name || 'Unnamed Module'}</span>
                    <div className="flex-shrink-0 ml-2">
                      {openModules.has(moduleWithChapters.module?.id) ? (
                        <CaretDown size={16} />
                      ) : (
                        <CaretRight size={16} />
                      )}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-4 mt-2">
                  {moduleWithChapters.module?.description && moduleWithChapters.module.description.trim() !== '' && (
                    <div className="p-2 bg-gray-50 rounded text-sm text-gray-600 mb-2">
                      {moduleWithChapters.module.description}
                    </div>
                  )}
                  {renderChapters(moduleWithChapters)}
                </CollapsibleContent>
              </Collapsible>
            );
          } else {
            // Module is "default", render chapters directly
            const chapters = moduleWithChapters.chapters || [];
            chapters.forEach((chapter, chapterIndex) => {
              const isChapterDefault = isDefaultName(chapter.chapter_name);

              if (!isChapterDefault) {
                // Chapter is not default, show it
                result.push(
                  <Collapsible
                    key={`${chapter.id}-${chapterIndex}`}
                    open={openChapters.has(chapter.id)}
                    onOpenChange={() => toggleChapter(chapter.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <FileText size={16} className="mr-2 text-green-500 flex-shrink-0" />
                        <span className="text-sm font-medium break-words truncate flex-1 min-w-0">{chapter.chapter_name || 'Unnamed Chapter'}</span>
                        <div className="flex-shrink-0 ml-2">
                          {openChapters.has(chapter.id) ? (
                            <CaretDown size={16} />
                          ) : (
                            <CaretRight size={16} />
                          )}
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="ml-4 mt-2">
                      {renderSlides(chapter.id)}
                    </CollapsibleContent>
                  </Collapsible>
                );
              } else {
                // Chapter is "default", render slides directly from chapter.slides
                const slides = (chapter as any).slides || [];
                
                slides.forEach((slide: Slide, slideIndex: number) => {
                  const { Icon, color, label } = getSlideIcon(slide);
                  result.push(
                    <div
                      key={`${slide.id}-${slideIndex}`}
                      className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 overflow-hidden"
                    >
                      <Icon size={16} className={`flex-shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium break-words truncate">{slide.title}</span>
                          <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">({label})</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              }
            });
          }
        });
      }
    });

    if (result.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No content available for this course.
        </div>
      );
    }

    return <div className="space-y-2">{result}</div>;
  };



  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (studyLibraryData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Course Structure</h3>
          <p className="text-gray-500 mb-4">No course structure data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2">
            <TreeStructure size={18} className="text-primary-600" />
            <span className="text-sm font-medium text-gray-700">
              Course Structure
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={isAllExpanded ? collapseAll : expandAll}
            >
              {isAllExpanded ? "Collapse All" : "Expand All"}
            </Button>
          </div>
        </div>

        {/* Course Structure */}
        <div className="space-y-2">
          {courseDepth === 2 && (
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Course Content (Slides Only)</h3>
              {renderSlidesForDepth2()}
            </div>
          )}

          {courseDepth === 3 && (
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Course Content (Chapters & Slides)</h3>
              {renderAllChaptersForDepth3()}
            </div>
          )}

          {courseDepth === 4 && (
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Course Content (Modules, Chapters & Slides)</h3>
              {renderModulesForDepth4()}
            </div>
          )}

          {courseDepth === 5 && (
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Course Content (Full Structure)</h3>
              {renderSubjectsForDepth5()}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
