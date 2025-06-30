import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { fetchStaticData } from "./-lib/utils";
import { DashboardTabs } from "./-components/DashboardTabs";
import { Helmet } from "react-helmet";
import { fetchStudentDetails } from "@/services/studentDetails";
import { getUserId } from "@/constants/getUserId";
import { getInstituteId } from "@/constants/helper";
import { Preferences } from "@capacitor/preferences";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { fetchStudyLibraryDetails } from "@/services/study-library/getStudyLibraryDetails";
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";
import {
  DashbaordResponse,
  DashboardSlide,
} from "./-types/dashboard-data-types";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { PastLearningInsights } from "./-components/PastLearningInsights";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async () => {
    const instituteId = await getInstituteId();
    const userId = await getUserId();
    if (!instituteId || !userId) {
      throw new Error("Institute ID or User ID is missing");
    }
    await fetchAndStoreInstituteDetails(instituteId, userId);
    const response = await fetchStudentDetails(instituteId, userId);
    const studentDetails = response.data[0];
    await Preferences.set({
      key: "studentDetails",
      value: JSON.stringify(studentDetails),
    });
  },
  component: () => {
    // const { studentDetails } = Route.useLoaderData();

    return (
      <LayoutContainer>
        <DashboardComponent />
      </LayoutContainer>
    );
  },
});

export function DashboardComponent() {
  const [username, setUsername] = useState<string | null>(null);
  const [testAssignedCount, setTestAssignedCount] = useState<number>(0);
  const [homeworkAssignedCount, setHomeworkAssignedCount] = useState<number>(0);

  const { setNavHeading } = useNavHeadingStore();
  const navigate = useNavigate();
  const { studyLibraryData, setStudyLibraryData } = useStudyLibraryStore();
  const [data, setData] = useState<DashbaordResponse | null>(null);
  const { setActiveItem } = useContentStore();

  const handleGetStudyLibraryData = async () => {
    const PackageSessionId = await getPackageSessionId();
    const data = await fetchStudyLibraryDetails(PackageSessionId);
    setStudyLibraryData(data);
  };

  const handleResumeClick = (slide: DashboardSlide) => {
    setActiveItem({
      id: slide.slide_id,
      source_id: "",
      source_type: slide.source_type,
      title: slide.slide_title,
      image_file_id: "",
      description: slide.slide_description,
      status: slide.status,
      slide_order: 0,
      is_loaded: false,
      new_slide: false,
      percentage_completed: 0,
      progress_marker: slide.progress_marker,
    });
    navigate({
      to: `/study-library/courses/levels/subjects/modules/chapters/slides?subjectId=${slide.subject_id}&moduleId=${slide.module_id}&chapterId=${slide.chapter_id}&slideId=${slide.slide_id}`,
    });
  };

  useEffect(() => {
    setNavHeading("Dashboard");
    fetchStaticData(
      setUsername,
      setTestAssignedCount,
      setHomeworkAssignedCount,
      setData
    );
    handleGetStudyLibraryData();
  }, []);

  return (
    <div className="space-y-3 md:space-y-4">
      <Helmet>
        <title>Dashboard</title>
        <meta name="description" content="Dashboard page" />
      </Helmet>
      
      {/* Compact Professional Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-neutral-100 rounded-full flex items-center justify-center">
            <span className="text-neutral-700 font-medium text-sm md:text-base">{username?.charAt(0)?.toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-base md:text-lg lg:text-xl font-medium text-neutral-900">Good morning, {username}</h1>
            <p className="text-xs md:text-sm text-neutral-500">Your learning overview</p>
          </div>
        </div>
        <div className="text-xs md:text-sm text-neutral-400 font-mono self-start sm:self-auto">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Ultra Compact Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
        {/* Study Materials */}
        <div
          onClick={() => navigate({ to: `/study-library/courses` })}
          className="group cursor-pointer"
        >
          <div className="bg-white border border-neutral-200 rounded-lg p-3 md:p-4 hover:border-neutral-300 transition-colors duration-200">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <div className="w-7 h-7 md:w-8 md:h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253" />
                </svg>
              </div>
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="space-y-0.5">
              <div className="text-xl md:text-2xl font-light text-neutral-900">{studyLibraryData?.length || 0}</div>
              <div className="text-xs md:text-sm text-neutral-600">Study Materials</div>
            </div>
          </div>
        </div>

        {/* Assignments */}
        <div
          onClick={() => navigate({ to: `/homework/list` })}
          className="group cursor-pointer"
        >
          <div className="bg-white border border-neutral-200 rounded-lg p-3 md:p-4 hover:border-neutral-300 transition-colors duration-200">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <div className="w-7 h-7 md:w-8 md:h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="space-y-0.5">
              <div className="text-xl md:text-2xl font-light text-neutral-900">{homeworkAssignedCount}</div>
              <div className="text-xs md:text-sm text-neutral-600">Assignments</div>
            </div>
          </div>
        </div>

        {/* Evaluations */}
        <div
          onClick={() => navigate({ to: `/assessment/examination` })}
          className="group cursor-pointer sm:col-span-2 lg:col-span-1"
        >
          <div className="bg-white border border-neutral-200 rounded-lg p-3 md:p-4 hover:border-neutral-300 transition-colors duration-200">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <div className="w-7 h-7 md:w-8 md:h-8 bg-neutral-100 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="space-y-0.5">
              <div className="text-xl md:text-2xl font-light text-neutral-900">{testAssignedCount}</div>
              <div className="text-xs md:text-sm text-neutral-600">Evaluations</div>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Continue Learning Section */}
      {data?.slides && data.slides.length > 0 && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-3 md:mb-4">
            <div>
              <h2 className="text-base md:text-lg font-medium text-neutral-900">Continue Learning</h2>
              <p className="text-xs md:text-sm text-neutral-500">{data.slides.length} lessons in progress</p>
            </div>
            <button 
              className="text-xs md:text-sm text-primary-600 hover:text-primary-700 transition-colors duration-200 self-start sm:self-auto"
              onClick={() => navigate({ to: `/study-library/courses` })}
            >
              View all →
            </button>
          </div>

          <div className="space-y-2 md:space-y-3">
            {data.slides.slice(0, 3).map((slide, index) => (
              <div 
                key={slide.slide_id} 
                className="flex items-center gap-2.5 md:gap-3 p-2.5 md:p-3 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors duration-200 cursor-pointer"
                onClick={() => handleResumeClick(slide)}
              >
                <div className="w-1.5 h-6 md:h-7 bg-neutral-300 rounded-full flex-shrink-0">
                  <div className="w-full h-1/3 bg-primary-500 rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs md:text-sm font-medium text-neutral-900 truncate">{slide.slide_title}</div>
                  <div className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{slide.slide_description || 'Continue from where you left off'}</div>
                </div>
                <div className="text-xs text-neutral-400 flex-shrink-0">
                  {index === 0 ? 'Next' : `${index + 1}`}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-neutral-200">
            <button 
              className="w-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs md:text-sm font-medium py-2.5 md:py-3 px-3 md:px-4 rounded-lg transition-colors duration-200"
              onClick={() => data.slides[0] && handleResumeClick(data.slides[0])}
            >
              Resume Learning
            </button>
          </div>
        </div>
      )}

      {/* Compact Empty State */}
      {(!data?.slides || data.slides.length === 0) && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 md:p-6 text-center">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm md:text-base font-medium text-neutral-900 mb-1 md:mb-2">All caught up</h3>
          <p className="text-xs md:text-sm text-neutral-500 mb-3 md:mb-4 max-w-sm mx-auto">You've completed all available lessons</p>
          <button 
            className="bg-primary-600 hover:bg-primary-700 text-white text-xs md:text-sm font-medium py-2 md:py-2.5 px-3 md:px-4 rounded-lg transition-colors duration-200"
            onClick={() => navigate({ to: `/study-library/courses` })}
          >
            Explore content
          </button>
        </div>
      )}

      {/* Analytics */}
      <div>
        <PastLearningInsights />
      </div>
    </div>
  );
}
