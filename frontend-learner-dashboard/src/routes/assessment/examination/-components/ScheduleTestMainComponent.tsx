import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useEffect, useState, useRef, useCallback } from "react";
import ScheduleTestTabList from "./ScheduleTestTabList";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { assessmentTypes } from "@/types/assessment";
import { fetchAssessmentData } from "../-utils.ts/useFetchAssessment";
import { AssessmentCard } from "../-components/AssessmentCard";
import { EmptyAssessment } from "@/svgs";
import { DashboardLoader } from "@/components/core/dashboard-loader";
// import PullToRefresh from "./PullToRefresh";

export const ScheduleTestMainComponent = ({
  assessment_types,
}: {
  assessment_types: "HOMEWORK" | "ASSESSMENT";
}) => {
  const { setNavHeading } = useNavHeadingStore();
  const [selectedTab, setSelectedTab] = useState<assessmentTypes>(
    assessmentTypes.LIVE
  );
  const [assessmentData, setAssessmentData] = useState<{
    [key in assessmentTypes]: any[];
  }>({
    [assessmentTypes.LIVE]: [],
    [assessmentTypes.UPCOMING]: [],
    [assessmentTypes.PAST]: [],
  });
  const [totalCounts, setTotalCounts] = useState<{
    [key in assessmentTypes]: number;
  }>({
    [assessmentTypes.LIVE]: 0,
    [assessmentTypes.UPCOMING]: 0,
    [assessmentTypes.PAST]: 0,
  });
  const [hasMorePages, setHasMorePages] = useState<{
    [key in assessmentTypes]: boolean;
  }>({
    [assessmentTypes.LIVE]: true,
    [assessmentTypes.UPCOMING]: true,
    [assessmentTypes.PAST]: true,
  });

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState<{ [key in assessmentTypes]: number }>({
    [assessmentTypes.LIVE]: 0,
    [assessmentTypes.UPCOMING]: 0,
    [assessmentTypes.PAST]: 0,
  });

  const observer = useRef<IntersectionObserver | null>(null);
  const pageSize = 5;

  useEffect(() => {
    setNavHeading(
      assessment_types === "ASSESSMENT" ? "Assessment" : "Homework"
    );
    fetchAllTabsData();
  }, []);

  const fetchAllTabsData = () => {
    Object.values(assessmentTypes).forEach((tab) => {
      fetchMoreData(tab, 0, true);
    });
  };

  const fetchMoreData = useCallback(
    async (tab: assessmentTypes, pageNum: number, isInitialLoad = false) => {
      if (loading || (loadingMore && !isInitialLoad) || !hasMorePages[tab])
        return;

      setLoading(isInitialLoad);
      setLoadingMore(!isInitialLoad);

      try {
        const data = await fetchAssessmentData(
          pageNum,
          pageSize,
          tab,
          assessment_types
        );

        setAssessmentData((prevData) => ({
          ...prevData,
          [tab]: isInitialLoad
            ? data.content
            : [...prevData[tab], ...data.content],
        }));

        setTotalCounts((prevCounts) => ({
          ...prevCounts,
          [tab]: data.total_elements,
        }));

        setHasMorePages((prev) => ({
          ...prev,
          [tab]: !data.last,
        }));

        setPage((prevPage) => ({
          ...prevPage,
          [tab]: pageNum + 1,
        }));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [loading, loadingMore, hasMorePages]
  );

  // const refreshCurrentTab = useCallback(async () => {
  //   setAssessmentData((prevData) => ({
  //     ...prevData,
  //     [selectedTab]: [],
  //   }));
  //   setPage((prevPage) => ({
  //     ...prevPage,
  //     [selectedTab]: 0,
  //   }));
  //   setHasMorePages((prev) => ({ ...prev, [selectedTab]: true }));
  //   await fetchMoreData(selectedTab, 0, true);
  // }, [selectedTab]);

  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loadingMore || !hasMorePages[selectedTab]) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          fetchMoreData(selectedTab, page[selectedTab]);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loadingMore, selectedTab, page, hasMorePages]
  );

  if (loading) {
    return <DashboardLoader />;
  }

  return (
    <div className="items-center gap-4 min-h-full">
      <Tabs
        value={selectedTab}
        onValueChange={(tab) => {
          setSelectedTab(tab as assessmentTypes);
        }}
      >
        <ScheduleTestTabList
          selectedTab={selectedTab}
          totalAssessments={totalCounts}
        />

        <TabsContent
          key={selectedTab}
          value={selectedTab}
          className="rounded-xl bg-neutral-50 flex flex-col gap-3"
        >
          {assessmentData[selectedTab].length > 0 ? (
            assessmentData[selectedTab].map((assessment, index) => {
              if (index === assessmentData[selectedTab].length - 1) {
                return (
                  <div ref={lastElementRef} key={assessment.assessment_id}>
                    <AssessmentCard
                      assessmentInfo={assessment}
                      assessmentType={selectedTab}
                      assessment_types={assessment_types}
                    />
                  </div>
                );
              }
              return (
                <AssessmentCard
                  key={assessment.assessment_id}
                  assessmentInfo={assessment}
                  assessmentType={selectedTab}
                  assessment_types={assessment_types}
                />
              );
            })
          ) : (
            <div className="flex h-screen flex-col items-center justify-center">
              {/* <img src={EmptyAssessment} alt="No Tests Available" /> */}
              <EmptyAssessment />
              <span className="text-neutral-600">No tests found.</span>
            </div>
            // <EmptyAssessment />
          )}
          {loading && (
            <div className="text-center text-primary-500 py-4">Loading...</div>
          )}
          {loadingMore && (
            <div className="">
              <div className="text-center text-primary-500 py-4">
                Loading more...
              </div>
              <DashboardLoader />
            </div>
          )}
        </TabsContent>

        {/* <TabsContent
          key={selectedTab}
          value={selectedTab}
          className="rounded-xl bg-neutral-50 flex flex-col gap-3"
        >
          <PullToRefresh onRefresh={refreshCurrentTab}>
            {assessmentData[selectedTab].length > 0 ? (
              assessmentData[selectedTab].map((assessment, index) => {
                if (index === assessmentData[selectedTab].length - 1) {
                  return (
                    <div ref={lastElementRef} key={assessment.assessment_id}>
                      <AssessmentCard
                        assessmentInfo={assessment}
                        assessmentType={selectedTab}
                      />
                    </div>
                  );
                }
                return (
                  <AssessmentCard
                    key={assessment.assessment_id}
                    assessmentInfo={assessment}
                    assessmentType={selectedTab}
                  />
                );
              })
            ) : (
              <div className="flex h-screen flex-col items-center justify-center">
                <img src={EmptyScheduleTest} alt="No Tests Available" />
                <span className="text-neutral-600">No tests found.</span>
              </div>
            )}
            {loading && <div className="text-center py-4">Loading...</div>}
            {loadingMore && (
              <div className="text-center py-4">Loading more...</div>
            )}
          </PullToRefresh>
        </TabsContent> */}
      </Tabs>
    </div>
  );
};
