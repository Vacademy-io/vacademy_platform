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
}

export const CourseStructureDetails: React.FC<CourseStructureDetailsProps> = ({
  courseDepth,
  courseId,
  instituteId,
  packageSessionId,
}) => {
  console.log("[CourseStructureDetails] Component props:", {
    courseDepth,
    courseId,
    instituteId,
    packageSessionId
  });

  const [isLoading, setIsLoading] = useState(true);
  const [studyLibraryData, setStudyLibraryData] = useState<SubjectType[]>([]);
  const [subjectModulesMap, setSubjectModulesMap] = useState<SubjectModulesMap>({});
  const [slidesMap, setSlidesMap] = useState<Record<string, Slide[]>>({});
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());
  const [openSlides, setOpenSlides] = useState<Set<string>>(new Set());

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

  // Step 1: Fetch package session data from init API
  const fetchPackageSessionData = async () => {
    console.log("[CourseStructureDetails] Step 1: Fetching package session data for:", packageSessionId);
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "https://backend-stage.vacademy.io";
      const url = `${baseUrl}/admin-core-service/open/v1/learner-study-library/init?instituteId=${instituteId}&packageSessionId=${packageSessionId}`;
      console.log("[CourseStructureDetails] Init API URL:", url);
      
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
      console.log("[CourseStructureDetails] Package session data received:", data);
      return data;
    } catch (error) {
      console.error("[CourseStructureDetails] Error fetching package session data:", error);
      throw error;
    }
  };

  // Step 2: Fetch modules for subjectId and packageSessionId
  const fetchModules = async (subjectId: string) => {
    console.log("[CourseStructureDetails] Step 2: Fetching modules for subjectId:", subjectId, "packageSessionId:", packageSessionId);
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "https://backend-stage.vacademy.io";
      const url = `${baseUrl}/admin-core-service/open/v1/learner-study-library/modules-with-chapters?subjectId=${subjectId}&packageSessionId=${packageSessionId}`;
      console.log("[CourseStructureDetails] Modules API URL:", url);
      
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
      console.log("[CourseStructureDetails] Modules received for subject", subjectId, ":", modules);
      console.log("[CourseStructureDetails] Modules count:", modules?.length);
      
      // Debug the structure of modules
      if (Array.isArray(modules) && modules.length > 0) {
        console.log("[CourseStructureDetails] First module structure:", modules[0]);
        console.log("[CourseStructureDetails] First module keys:", Object.keys(modules[0] || {}));
        if (modules[0].module) {
          console.log("[CourseStructureDetails] Module object structure:", modules[0].module);
          console.log("[CourseStructureDetails] Module ID:", modules[0].module.id);
        }
      }
      
      return modules || [];
    } catch (error) {
      console.error("[CourseStructureDetails] Error fetching modules for subject", subjectId, ":", error);
      return [];
    }
  };


  // Step 3: Fetch slides for a chapter
  const fetchSlidesForChapter = async (chapterId: string) => {
    console.log("[CourseStructureDetails] Step 3: Fetching slides for chapter:", chapterId);
    console.log("[CourseStructureDetails] ChapterId type:", typeof chapterId);
    console.log("[CourseStructureDetails] ChapterId is null?", chapterId === null);
    console.log("[CourseStructureDetails] ChapterId is undefined?", chapterId === undefined);
    
    if (!chapterId || chapterId === null || chapterId === undefined) {
      console.error("[CourseStructureDetails] ChapterId is null/undefined, cannot fetch slides");
      return [];
    }
    
    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "https://backend-stage.vacademy.io";
      const url = `${baseUrl}/admin-core-service/open/v1/learner-study-library/slides?chapterId=${chapterId}`;
      console.log("[CourseStructureDetails] Slides API URL:", url);
      
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
      console.log("[CourseStructureDetails] Slides received for chapter", chapterId, ":", slides);
      console.log("[CourseStructureDetails] Slides count:", slides?.length);
      
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
      console.log("[CourseStructureDetails] Step 4: Fetching slides for chapter:", chapterId);
      const baseUrl = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "https://backend-stage.vacademy.io";
      const slidesUrl = `${baseUrl}/admin-core-service/open/v1/learner-study-library/slides?chapterId=${chapterId}`;
      console.log("[CourseStructureDetails] Slides API URL:", slidesUrl);
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
      console.log("[CourseStructureDetails] Slides received for chapter", chapterId, ":", slides);
      console.log("[CourseStructureDetails] Slides count for chapter", chapterId, ":", slides?.length);
      
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
        console.log("[CourseStructureDetails] Starting data load for course depth:", courseDepth);

        // Step 1: Fetch package session data from init API
        const packageSessionData = await fetchPackageSessionData();
        console.log("[CourseStructureDetails] Package session data loaded");
        console.log("[CourseStructureDetails] Raw package session data:", JSON.stringify(packageSessionData, null, 2));

        // Extract subjects from package session data for the specific courseId
        const subjects: SubjectType[] = [];
        
        console.log("[CourseStructureDetails] Looking for courseId:", courseId);
        console.log("[CourseStructureDetails] Looking for packageSessionId:", packageSessionId);
        
        if (Array.isArray(packageSessionData)) {
          console.log("[CourseStructureDetails] Processing array with", packageSessionData.length, "courses");
          
          // Find the specific course by courseId
          const targetCourse = packageSessionData.find(courseData => courseData.course && courseData.course.id === courseId);
          
          if (targetCourse) {
            console.log("[CourseStructureDetails] Found target course:", targetCourse.course.package_name);
            
            if (targetCourse.sessions && Array.isArray(targetCourse.sessions)) {
              console.log(`[CourseStructureDetails] Course has ${targetCourse.sessions.length} sessions`);
              
              // For now, let's use the first session since the session matching logic might be incorrect
              // The packageSessionId might not match the session_dto.id in the response
              const targetSession = targetCourse.sessions[0]; // Use first session as fallback
              
              console.log(`[CourseStructureDetails] Using session:`, targetSession.session_dto?.session_name || 'Unknown');
              console.log(`[CourseStructureDetails] Session ID in response:`, targetSession.session_dto?.id);
              console.log(`[CourseStructureDetails] Expected packageSessionId:`, packageSessionId);
              
              if (targetSession.level_with_details && Array.isArray(targetSession.level_with_details)) {
                console.log(`[CourseStructureDetails] Session has ${targetSession.level_with_details.length} levels`);
                
                targetSession.level_with_details.forEach((level: any, levelIndex: number) => {
                  console.log(`[CourseStructureDetails] Level ${levelIndex}:`, level.name);
                  
                  if (level.subjects && Array.isArray(level.subjects)) {
                    console.log(`[CourseStructureDetails] Level has ${level.subjects.length} subjects`);
                    
                    level.subjects.forEach((subject: any, subjectIndex: number) => {
                      console.log(`[CourseStructureDetails] Subject ${subjectIndex}:`, subject);
                      
                      if (subject.id) {
                        const transformedSubject: SubjectType = {
                          id: subject.id,
                          subject_name: subject.subject_name || `Subject ${subjectIndex + 1}`,
                          subject_order: subject.subject_order || subjectIndex,
                          description: subject.description || '',
                        };
                        subjects.push(transformedSubject);
                        console.log("[CourseStructureDetails] Added subject with real ID:", subject.id, subject.subject_name);
                      }
                    });
                  }
                });
              } else {
                console.log("[CourseStructureDetails] No level_with_details found in target session");
              }
            } else {
              console.log("[CourseStructureDetails] No sessions found in target course");
            }
          } else {
            console.log("[CourseStructureDetails] No course found with courseId:", courseId);
            console.log("[CourseStructureDetails] Available course IDs:", packageSessionData.map((c: any) => c.course?.id));
          }
        } else {
          console.log("[CourseStructureDetails] PackageSessionData is not an array");
        }
        
        console.log("[CourseStructureDetails] Subjects extracted:", subjects.length);
        console.log("[CourseStructureDetails] Subjects:", subjects);
        setStudyLibraryData(subjects);

        // Step 2: Fetch modules for each subject
        const modulesMap: SubjectModulesMap = {};
        
        if (subjects.length === 0) {
          console.log("[CourseStructureDetails] No subjects found! This means the API calls will not proceed.");
          console.log("[CourseStructureDetails] This could be because:");
          console.log("1. CourseId not found in API response");
          console.log("2. PackageSessionId not found in the course sessions");
          console.log("3. No subjects in the session levels");
          console.log("[CourseStructureDetails] Available course IDs:", packageSessionData.map((c: any) => c.course?.id));
          console.log("[CourseStructureDetails] Creating fallback structure...");
          
          // Try to get any subject from any course as fallback
          let fallbackSubjectId = null;
          let fallbackSubjectName = "Course Content";
          
          if (Array.isArray(packageSessionData)) {
            for (const courseData of packageSessionData) {
              if (courseData.sessions && Array.isArray(courseData.sessions)) {
                for (const session of courseData.sessions) {
                  if (session.level_with_details && Array.isArray(session.level_with_details)) {
                    for (const level of session.level_with_details) {
                      if (level.subjects && Array.isArray(level.subjects) && level.subjects.length > 0) {
                        fallbackSubjectId = level.subjects[0].id;
                        fallbackSubjectName = level.subjects[0].subject_name || "Course Content";
                        console.log("[CourseStructureDetails] Using fallback subjectId:", fallbackSubjectId, "name:", fallbackSubjectName);
                        break;
                      }
                    }
                    if (fallbackSubjectId) break;
                  }
                }
                if (fallbackSubjectId) break;
              }
            }
          }
          
          // Create a fallback structure to ensure something is displayed
          const fallbackSubject: SubjectType = {
            id: fallbackSubjectId || "fallback-subject",
            subject_name: fallbackSubjectName,
            subject_order: 0,
            description: "Course modules and chapters",
          };
          setStudyLibraryData([fallbackSubject]);
          
          // Try to fetch modules with the fallback subjectId
          if (fallbackSubjectId) {
            console.log("[CourseStructureDetails] Attempting fallback: fetching modules with fallback subjectId:", fallbackSubjectId);
            try {
              const fallbackModules = await fetchModules(fallbackSubjectId);
              console.log("[CourseStructureDetails] Fallback modules received:", fallbackModules.length);
              
              const modulesWithChapters: ModuleWithChapters[] = [];
              for (const moduleItem of fallbackModules) {
                console.log("[CourseStructureDetails] Processing fallback module item:", moduleItem);
                console.log("[CourseStructureDetails] Fallback module item keys:", Object.keys(moduleItem || {}));
                console.log("[CourseStructureDetails] Fallback module item.module:", moduleItem.module);
                console.log("[CourseStructureDetails] Fallback module item.chapters:", moduleItem.chapters);
                
                // The API response has structure: { module: {...}, chapters: [...] }
                const moduleData = moduleItem.module;
                const chapters = moduleItem.chapters || [];
                
                console.log("[CourseStructureDetails] Fallback module data:", moduleData);
                console.log("[CourseStructureDetails] Fallback module name:", moduleData?.module_name);
                console.log("[CourseStructureDetails] Fallback chapters from module:", chapters.length);
                
                // Fetch slides for each chapter
                const chaptersWithSlides = [];
                for (const chapter of chapters) {
                  console.log("[CourseStructureDetails] Processing fallback chapter:", chapter.id, chapter.chapter_name);
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
              
              modulesMap[fallbackSubjectId] = modulesWithChapters;
            } catch (error) {
              console.error("[CourseStructureDetails] Fallback also failed:", error);
            }
          }
        } else {
          console.log("[CourseStructureDetails] Processing", subjects.length, "subjects");
          for (const subject of subjects) {
            console.log("[CourseStructureDetails] Fetching modules for subject:", subject.id);
            const modules = await fetchModules(subject.id);
            
            // Step 3: Process modules and fetch slides for each chapter
            const modulesWithChapters: ModuleWithChapters[] = [];
            for (const moduleItem of modules) {
              console.log("[CourseStructureDetails] Processing module item:", moduleItem);
              console.log("[CourseStructureDetails] Module item keys:", Object.keys(moduleItem || {}));
              console.log("[CourseStructureDetails] Module item.module:", moduleItem.module);
              console.log("[CourseStructureDetails] Module item.chapters:", moduleItem.chapters);
              
              // The API response has structure: { module: {...}, chapters: [...] }
              const moduleData = moduleItem.module;
              const chapters = moduleItem.chapters || [];
              
              console.log("[CourseStructureDetails] Module data:", moduleData);
              console.log("[CourseStructureDetails] Module name:", moduleData?.module_name);
              console.log("[CourseStructureDetails] Chapters from module:", chapters.length);
              
              // Fetch slides for each chapter
              const chaptersWithSlides = [];
              for (const chapter of chapters) {
                console.log("[CourseStructureDetails] Processing chapter:", chapter.id, chapter.chapter_name);
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
          // Depth 2: Only show slides
          console.log("[CourseStructureDetails] Depth 2: Will show only slides");
          // Preload slides for all chapters since we only show slides
          const allChapterIds = new Set<string>();
          Object.values(modulesMap).forEach((modules) => {
            modules.forEach((mod) => {
              mod.chapters.forEach((ch) => {
                allChapterIds.add(ch.id);
                getSlidesWithChapterId(ch.id);
              });
            });
          });
          setOpenSubjects(new Set(subjects.map(s => s.id)));
        } else if (courseDepth === 3) {
          // Depth 3: Show chapters and slides
          console.log("[CourseStructureDetails] Depth 3: Will show chapters and slides");
          const allChapterIds = new Set<string>();
          Object.values(modulesMap).forEach((modules) => {
            modules.forEach((mod) => {
              mod.chapters.forEach((ch) => {
                allChapterIds.add(ch.id);
              });
            });
          });
          setOpenSubjects(new Set(subjects.map(s => s.id)));
          setOpenChapters(allChapterIds);
        } else if (courseDepth === 4) {
          // Depth 4: Show modules, chapters, slides
          console.log("[CourseStructureDetails] Depth 4: Will show modules, chapters, slides");
          const allModuleIds = new Set<string>();
          const allChapterIds = new Set<string>();
          Object.values(modulesMap).forEach((modules) => {
            modules.forEach((mod) => {
              allModuleIds.add(mod.module.id);
              mod.chapters.forEach((ch) => {
                allChapterIds.add(ch.id);
              });
            });
          });
          setOpenSubjects(new Set(subjects.map(s => s.id)));
          setOpenModules(allModuleIds);
          setOpenChapters(allChapterIds);
        } else if (courseDepth === 5) {
          // Depth 5: Show everything - subjects, modules, chapters, slides
          console.log("[CourseStructureDetails] Depth 5: Will show full hierarchy");
          const allSubjectIds = new Set<string>(subjects.map(s => s.id));
          const allModuleIds = new Set<string>();
          const allChapterIds = new Set<string>();
          Object.values(modulesMap).forEach((modules) => {
            modules.forEach((mod) => {
              allModuleIds.add(mod.module.id);
              mod.chapters.forEach((ch) => {
                allChapterIds.add(ch.id);
              });
            });
          });
          setOpenSubjects(allSubjectIds);
          setOpenModules(allModuleIds);
          setOpenChapters(allChapterIds);
        }

        console.log("[CourseStructureDetails] Data loading completed successfully");
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
    toggleOpenState(chapterId, setOpenChapters);
    // Load slides when chapter is expanded
    if (!openChapters.has(chapterId)) {
      getSlidesWithChapterId(chapterId);
    }
  };

  const expandAll = () => {
    const allSubjectIds = new Set(studyLibraryData.map(s => s.id));
    const allModuleIds = new Set<string>();
    const allChapterIds = new Set<string>();
    const allSlideIds = new Set<string>();

    // Collect all module, chapter, and slide IDs
    Object.values(subjectModulesMap).forEach(modules => {
      modules.forEach(module => {
        allModuleIds.add(module.module.id);
        module.chapters.forEach(chapter => {
          allChapterIds.add(chapter.id);
          if (slidesMap[chapter.id]) {
            slidesMap[chapter.id].forEach(slide => {
              allSlideIds.add(slide.id);
            });
          }
        });
      });
    });

    setOpenSubjects(allSubjectIds);
    setOpenModules(allModuleIds);
    setOpenChapters(allChapterIds);
    setOpenSlides(allSlideIds);
  };

  const collapseAll = () => {
    setOpenSubjects(new Set());
    setOpenModules(new Set());
    setOpenChapters(new Set());
    setOpenSlides(new Set());
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
    if (chapters.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No chapters available for this module.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {chapters.map((chapter, index) => (
          <Collapsible
            key={`${chapter.id}-${index}`}
            open={openChapters.has(chapter.id)}
            onOpenChange={() => toggleChapter(chapter.id)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg"
              >
                <FileText size={16} className="mr-2 text-green-500" />
                <span className="text-sm font-medium">{chapter.chapter_name || 'Unnamed Chapter'}</span>
                {openChapters.has(chapter.id) ? (
                  <CaretDown size={16} className="ml-auto" />
                ) : (
                  <CaretRight size={16} className="ml-auto" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-4 mt-2">
              <div className="p-2 bg-gray-50 rounded text-sm text-gray-600 mb-2">
                {chapter.description || 'No description available'}
              </div>
              {renderSlides(chapter.id)}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  };

  const renderSlides = (chapterId: string) => {
    const slides = slidesMap[chapterId] || [];
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
            <Collapsible
              key={`${slide.id}-${index}`}
              open={openSlides.has(slide.id)}
              onOpenChange={() => toggleOpenState(slide.id, setOpenSlides)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <Icon size={16} className={`mr-2 ${color}`} />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{slide.title}</span>
                    <span className="text-xs text-gray-500 ml-2">({label})</span>
                  </div>
                  {openSlides.has(slide.id) ? (
                    <CaretDown size={16} className="ml-auto" />
                  ) : (
                    <CaretRight size={16} className="ml-auto" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-4 mt-2">
                <div className="p-2 bg-gray-50 rounded text-sm text-gray-600">
                  {slide.description || 'No description available'}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    );
  };

  const renderModules = (subjectId: string) => {
    const modules = subjectModulesMap[subjectId] || [];
    console.log(`[CourseStructureDetails] renderModules for subject ${subjectId}:`, modules);
    if (modules.length === 0) return null;

    return (
      <div className="space-y-2">
        {modules.map((moduleWithChapters, index) => (
          <Collapsible
            key={`${moduleWithChapters.module?.id}-${index}`}
            open={openModules.has(moduleWithChapters.module?.id)}
            onOpenChange={() => toggleOpenState(moduleWithChapters.module?.id, setOpenModules)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg"
              >
                <Folder size={16} className="mr-2 text-orange-500" />
                <span className="text-sm font-medium">{moduleWithChapters.module?.module_name || 'Unnamed Module'}</span>
                {openModules.has(moduleWithChapters.module?.id) ? (
                  <CaretDown size={16} className="ml-auto" />
                ) : (
                  <CaretRight size={16} className="ml-auto" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-4 mt-2">
              <div className="p-2 bg-gray-50 rounded text-sm text-gray-600 mb-2">
                {moduleWithChapters.module?.description || 'No description available'}
              </div>
              {renderChapters(moduleWithChapters)}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  };

  // Render slides only for depth 2
  const renderSlidesForDepth2 = () => {
    const allSlides: Slide[] = [];
    
    console.log("[CourseStructureDetails] renderSlidesForDepth2 - Processing modules and chapters");
    Object.values(subjectModulesMap).forEach((modules, subjectIndex) => {
      console.log(`[CourseStructureDetails] Subject ${subjectIndex}:`, modules.length, "modules");
      modules.forEach((moduleWithChapters, moduleIndex) => {
        console.log(`[CourseStructureDetails] Module ${moduleIndex}:`, moduleWithChapters.chapters.length, "chapters");
        moduleWithChapters.chapters.forEach((chapter, chapterIndex) => {
          console.log(`[CourseStructureDetails] Chapter ${chapterIndex}:`, chapter.chapter_name, "ID:", chapter.id);
          if (slidesMap[chapter.id]) {
            console.log(`[CourseStructureDetails] Found ${slidesMap[chapter.id].length} slides for chapter ${chapter.id}`);
            allSlides.push(...slidesMap[chapter.id]);
          } else {
            console.log(`[CourseStructureDetails] No slides found for chapter ${chapter.id}`);
          }
        });
      });
    });

    console.log("[CourseStructureDetails] Total slides collected for depth 2:", allSlides.length);

    if (allSlides.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No slides available for this course.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {allSlides.map((slide, index) => {
          const { Icon, color, label } = getSlideIcon(slide);
          return (
            <div
              key={`${slide.id}-${index}`}
              className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Icon size={16} className={color} />
              <div className="flex-1">
                <span className="text-sm font-medium">{slide.title}</span>
                <span className="text-xs text-gray-500 ml-2">({label})</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render all chapters for depth 3
  const renderAllChaptersForDepth3 = () => {
    const allChapters: Chapter[] = [];
    
    Object.values(subjectModulesMap).forEach((modules) => {
      modules.forEach((moduleWithChapters) => {
        allChapters.push(...moduleWithChapters.chapters);
      });
    });

    if (allChapters.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No chapters available for this course.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {allChapters.map((chapter, index) => (
          <Collapsible
            key={`${chapter.id}-${index}`}
            open={openChapters.has(chapter.id)}
            onOpenChange={() => toggleChapter(chapter.id)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg"
              >
                <FileText size={16} className="mr-2 text-green-500" />
                <span className="text-sm font-medium">{chapter.chapter_name || 'Unnamed Chapter'}</span>
                {openChapters.has(chapter.id) ? (
                  <CaretDown size={16} className="ml-auto" />
                ) : (
                  <CaretRight size={16} className="ml-auto" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-4 mt-2">
              <div className="p-2 bg-gray-50 rounded text-sm text-gray-600 mb-2">
                {chapter.description || 'No description available'}
              </div>
              {renderSlides(chapter.id)}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  };

  // Render all modules for depth 4
  const renderModulesForDepth4 = () => {
    const allModules: ModuleWithChapters[] = [];
    
    console.log("[CourseStructureDetails] renderModulesForDepth4 - subjectModulesMap:", subjectModulesMap);
    Object.values(subjectModulesMap).forEach((modules) => {
      allModules.push(...modules);
    });
    console.log("[CourseStructureDetails] renderModulesForDepth4 - allModules:", allModules);

    if (allModules.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No modules available for this course.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {allModules.map((moduleWithChapters, index) => (
          <Collapsible
            key={`${moduleWithChapters.module?.id}-${index}`}
            open={openModules.has(moduleWithChapters.module?.id)}
            onOpenChange={() => toggleModule(moduleWithChapters.module?.id)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start p-2 h-auto text-left border border-gray-200 rounded-lg"
              >
                <Folder size={16} className="mr-2 text-blue-500" />
                <span className="text-sm font-medium">{moduleWithChapters.module?.module_name || 'Unnamed Module'}</span>
                {openModules.has(moduleWithChapters.module?.id) ? (
                  <CaretDown size={16} className="ml-auto" />
                ) : (
                  <CaretRight size={16} className="ml-auto" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-4 mt-2">
              <div className="p-2 bg-gray-50 rounded text-sm text-gray-600 mb-2">
                {moduleWithChapters.module?.description || 'No description available'}
              </div>
              {renderChapters(moduleWithChapters)}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  };

  // Render all subjects for depth 5
  const renderSubjectsForDepth5 = () => {
    if (studyLibraryData.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          No subjects available for this course.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {studyLibraryData.map((subject, index) => (
          <Collapsible
            key={`${subject.id}-${index}`}
            open={openSubjects.has(subject.id)}
            onOpenChange={() => toggleSubject(subject.id)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start p-3 h-auto text-left border border-gray-200 rounded-lg"
              >
                <FolderOpen size={18} className="mr-3 text-purple-500" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{subject.subject_name}</div>
                  <div className="text-sm text-gray-500">{subject.description}</div>
                </div>
                {openSubjects.has(subject.id) ? (
                  <CaretDown size={16} className="ml-auto" />
                ) : (
                  <CaretRight size={16} className="ml-auto" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-4 mt-2">
              {renderModules(subject.id)}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
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
