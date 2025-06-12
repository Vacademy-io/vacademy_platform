import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useEffect, useState } from "react";
import { fetchStaticData } from "./-lib/utils";
import { DashboardTabs } from "./-components/DashboardTabs";
import { Helmet } from "react-helmet";
import { DashboardImg } from "@/assets/svgs";
import { fetchStudentDetails } from "@/services/studentDetails";
import { getUserId } from "@/constants/getUserId";
import { getInstituteId } from "@/constants/helper";
import { Preferences } from "@capacitor/preferences";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { fetchStudyLibraryDetails } from "@/services/study-library/getStudyLibraryDetails";
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";
import { MyButton } from "@/components/design-system/button";
import { DashbaordResponse, DashboardSlide } from "./-types/dashboard-data-types";
import { getIcon } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/chapter-sidebar-slides";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
// import { PastLearningInsights } from "./-components/PastLearningInsights";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async () => {
    const instituteId = await getInstituteId();
    const userId = await getUserId();
    if (!instituteId || !userId) {
      throw new Error("Institute ID or User ID is missing");
    }
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
      progress_marker: slide.progress_marker
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
    <div>
      <Helmet>
        <title>Dashboard</title>
        <meta name="description" content="Dashboard page" />
      </Helmet>
      <div className="text-h3">
        <div>
          Hello <span className="text-primary-500">{username}!</span>
        </div>
        <div className="text-body mt-2">
          Excited to have you here! Let's dive into learning!
        </div>
      </div>
      <div className="my-6 w-fit mx-auto">
        <DashboardImg />
      </div>
      <div className="flex flex-col gap-6">
        <div
          onClick={() => {
            navigate({
              to: `/study-library/courses`,
            });
          }}
          className="cursor-pointer"
        >
          <DashboardTabs
            title={"Subjects"}
            count={studyLibraryData?.length}
            button={false}
          />
        </div>
        <div
          onClick={() => {
            navigate({
              to: `/homework/list`,
            });
          }}
          className="cursor-pointer"
        >
          <DashboardTabs
            title={"Home work assigned "}
            count={homeworkAssignedCount}
            button={false}
          />
        </div>
        {/* TODO: implemnet resume feature after api is changed */}
        {/* <DashboardTabs
            title="Begin your journey"
            count={data?.slides.length}
            button={true}
            buttonText="Resume"
            list={data?.slides}
          /> */}
        
       <div className="p-4 w-full flex flex-col gap-4 rounded-lg border border-neutral-200 ">
          <p className="text-subtitle font-semibold">Continue where you left</p>
          {data?.slides.map((slide) => (
            <div key={slide.slide_id} className="flex gap-2 justify-between">
              <div className="flex gap-2">
                {getIcon(slide?.source_type)}
                <p>{slide?.slide_title}</p>
              </div>
              <MyButton buttonType="secondary" className="w-fit" onClick={()=>handleResumeClick(slide)}>Resume</MyButton>
            </div>
          ))}
       </div>
        <div
          onClick={() => {
            navigate({
              to: `/assessment/examination`,
            });
          }}
          className="cursor-pointer"
        >
          <DashboardTabs
            title="Test Assigned"
            count={testAssignedCount}
            button={false}
          />

        </div>
          {/* <PastLearningInsights /> */}
      </div>
    </div>
  );
}
