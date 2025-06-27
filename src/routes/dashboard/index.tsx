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
    <div className="space-y-4">
      <Helmet>
        <title>Dashboard</title>
        <meta name="description" content="Dashboard page" />
      </Helmet>
      
             {/* Clean Professional Header */}
       <div className="flex items-center justify-between bg-white p-6 rounded-lg border border-gray-200 shadow-sm relative z-50">
         <div className="flex items-center gap-4">
           <div className="p-3 bg-primary-50 rounded-lg">
             <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h2a2 2 0 012 2v0M8 5a2 2 0 012-2h2a2 2 0 012 2v0" />
             </svg>
           </div>
           <div>
             <h1 className="text-xl font-semibold text-gray-900">
               Welcome back, <span className="text-primary-600">{username}</span>
             </h1>
             <p className="text-sm text-gray-500 mt-1">Dashboard Overview</p>
           </div>
         </div>
         <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
           <div className="w-2 h-2 bg-green-500 rounded-full"></div>
           <span className="text-sm font-medium text-gray-700">
             {new Date().toLocaleDateString('en-US', { 
               weekday: 'short', 
               month: 'short', 
               day: 'numeric' 
             })}
           </span>
         </div>
       </div>

      {/* Professional Dashboard Layout */}
      <div className="space-y-8">
        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            onClick={() => {
              navigate({
                to: `/study-library/courses`,
              });
            }}
            className="cursor-pointer group"
          >
            <DashboardTabs
              title={"Subjects"}
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
              title={"Homework"}
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
              title="Assessments"
              count={testAssignedCount}
              button={false}
            />
          </div>

          {/* Continue Learning Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
            {/* Header with Icon */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary-50 rounded-lg">
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-base font-semibold text-gray-900">
                Continue Learning
              </div>
            </div>
            
            {/* Count Badge */}
            <div className="inline-flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700 mb-3">
              {data?.slides?.length || 0}
            </div>
            
            {/* Status */}
            <div className="text-sm text-gray-500 mb-4">
              <span className="inline-flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${!data?.slides || data.slides.length === 0 ? 'bg-gray-300' : 'bg-green-500'}`}></div>
                {!data?.slides || data.slides.length === 0 ? 'No items available' : `${data.slides.length} ${data.slides.length === 1 ? 'item' : 'items'} ready`}
              </span>
            </div>

            {/* List Items */}
            {data?.slides && data.slides.length > 0 && (
              <div className="space-y-3 mb-4">
                {data.slides.slice(0, 3).map((slide) => (
                  <div 
                    key={slide.slide_id} 
                    className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                  >
                    <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0"></div>
                    <div className="truncate text-sm font-medium text-gray-700 flex-1 min-w-0">{slide.slide_title}</div>
                  </div>
                ))}
                {data.slides.length > 3 && (
                  <div className="text-sm text-gray-400 pl-5">
                    +{data.slides.length - 3} more items
                  </div>
                )}
              </div>
            )}

            {/* Action Button */}
            {data?.slides && data.slides.length > 0 && (
              <button 
                className="w-full bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 shadow-sm border border-primary-600"
                onClick={() => data.slides[0] && handleResumeClick(data.slides[0])}
              >
                Resume Learning
              </button>
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
