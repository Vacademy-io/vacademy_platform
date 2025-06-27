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
    <div className="space-y-6">
      <Helmet>
        <title>Dashboard</title>
        <meta name="description" content="Dashboard page" />
      </Helmet>
      
      {/* Compact Welcome Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-white to-primary-50/30 p-5 rounded-lg border border-neutral-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200 rounded-lg">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h2a2 2 0 012 2v0M8 5a2 2 0 012-2h2a2 2 0 012 2v0" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              Welcome back, <span className="text-primary-600">{username}</span>
            </h1>
            <p className="text-sm text-neutral-500 mt-0.5">Let's continue your learning journey</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-200 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-neutral-700">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            })}
          </span>
        </div>
      </div>

      {/* Compact Dashboard Layout */}
      <div className="space-y-6">
        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => {
              navigate({
                to: `/study-library/courses`,
              });
            }}
            className="cursor-pointer group"
          >
            <DashboardTabs
              title={"Study Materials"}
              count={studyLibraryData?.length || 0}
              button={false}
            />
          </div>
          
          <div
            onClick={() => {
              navigate({
                to: `/homework/list`,
            });
            }}
            className="cursor-pointer group"
          >
            <DashboardTabs
              title={"Assignments"}
              count={homeworkAssignedCount}
              button={false}
            />
          </div>

          <div
            onClick={() => {
              navigate({
                to: `/assessment/examination`,
              });
            }}
            className="cursor-pointer group"
          >
            <DashboardTabs
              title="Evaluations"
              count={testAssignedCount}
              button={false}
            />
          </div>

          {/* Continue Learning Card */}
          <div className="bg-gradient-to-br from-white to-primary-50/20 border border-neutral-200 rounded-lg transition-all duration-200 hover:border-primary-300 p-4 group">
            {/* Header with Icon */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 border border-primary-300 rounded-lg group-hover:scale-105 transition-transform duration-200">
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-sm font-semibold text-neutral-900">
                Continue From Where You Left
              </div>
            </div>
            
            {/* Count Badge */}
            <div className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-neutral-100 to-neutral-200 border border-neutral-300 rounded-full text-xs font-medium text-neutral-700 mb-3">
              {data?.slides?.length || 0} pending
            </div>
            
            {/* Status */}
            <div className="text-xs text-neutral-500 mb-3">
              <span className="inline-flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${!data?.slides || data.slides.length === 0 ? 'bg-neutral-300' : 'bg-green-500 animate-pulse'}`}></div>
                {!data?.slides || data.slides.length === 0 ? 'All caught up!' : `${data.slides.length} ${data.slides.length === 1 ? 'lesson' : 'lessons'} waiting`}
              </span>
            </div>

            {/* List Items */}
            {data?.slides && data.slides.length > 0 && (
              <div className="space-y-2 mb-3">
                {data.slides.slice(0, 2).map((slide) => (
                  <div 
                    key={slide.slide_id} 
                    className="flex items-center gap-2 py-1.5 px-2.5 bg-white border border-neutral-200 rounded-md hover:border-primary-300 transition-colors duration-150"
                  >
                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full flex-shrink-0"></div>
                    <div className="truncate text-xs font-medium text-neutral-700 flex-1 min-w-0">{slide.slide_title}</div>
                  </div>
                ))}
                {data.slides.length > 2 && (
                  <div className="text-xs text-neutral-400 pl-4">
                    +{data.slides.length - 2} more lessons
                  </div>
                )}
              </div>
            )}

            {/* Action Button */}
            {data?.slides && data.slides.length > 0 ? (
              <button 
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-all duration-200 border border-primary-600"
                onClick={() => data.slides[0] && handleResumeClick(data.slides[0])}
              >
                Resume Learning
              </button>
            ) : (
              <div className="w-full bg-gradient-to-r from-neutral-100 to-neutral-200 text-neutral-500 text-xs font-medium py-2 px-3 rounded-lg border border-neutral-300 text-center">
                You're all caught up! 🎉
              </div>
            )}
          </div>
        </div>

        {/* Analytics Section */}
        <div className="w-full">
          <PastLearningInsights />
        </div>
      </div>
    </div>
  );
}
