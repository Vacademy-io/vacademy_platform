import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useEffect, useState, useRef, useCallback } from "react";
import ScheduleTestTabList from "./ScheduleTestTabList";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { assessmentTypes, Assessment } from "@/types/assessment";
import { fetchAssessmentData } from "../-utils.ts/useFetchAssessment";
import { AssessmentCard } from "../-components/AssessmentCard";
import { EmptyAssessment } from "@/svgs";
import { DashboardLoader } from "@/components/core/dashboard-loader";

export const ScheduleTestMainComponent = ({
  assessment_types,
}: {
  assessment_types: "HOMEWORK" | "ASSESSMENT";
}) => {
  const setNavHeading = useNavHeadingStore((s) => s.setNavHeading);
  const [selectedTab, setSelectedTab] = useState<assessmentTypes>(
    assessmentTypes.LIVE
  );
  const [assessmentData, setAssessmentData] = useState<{
    [key in assessmentTypes]: Assessment[];
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

  const loadingRef = useRef(loading);
  const loadingMoreRef = useRef(loadingMore);
  const hasMorePagesRef = useRef(hasMorePages);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  useEffect(() => {
    hasMorePagesRef.current = hasMorePages;
  }, [hasMorePages]);

  const observer = useRef<IntersectionObserver | null>(null);
  const pageSize = 5;

  const fetchMoreData = useCallback(
    async (tab: assessmentTypes, pageNum: number, isInitialLoad = false) => {
      if (
        loadingRef.current ||
        (loadingMoreRef.current && !isInitialLoad) ||
        !hasMorePagesRef.current[tab]
      )
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
    [assessment_types]
  );

  const fetchAllTabsData = useCallback(() => {
    Object.values(assessmentTypes).forEach((tab) => {
      fetchMoreData(tab, 0, true);
    });
  }, [fetchMoreData]);

  useEffect(() => {
    const nextHeading = assessment_types === "ASSESSMENT" ? "Assessment" : "Homework";
    setNavHeading(nextHeading);
    fetchAllTabsData();
  }, [assessment_types, fetchAllTabsData, setNavHeading]);

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
    [loadingMore, selectedTab, page, hasMorePages, fetchMoreData]
  );

  if (loading) {
    return <DashboardLoader />;
  }

  return (
    <div className="w-full space-y-6">
      <Tabs
        value={selectedTab}
        onValueChange={(tab) => {
          setSelectedTab(tab as assessmentTypes);
        }}
        className="w-full"
      >
        <ScheduleTestTabList
          selectedTab={selectedTab}
          totalAssessments={totalCounts}
        />

        <TabsContent
          key={selectedTab}
          value={selectedTab}
          className="mt-6 flex flex-col gap-4 focus-visible:outline-none"
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
            <div className="flex min-h-[40vh] sm:h-[60vh] flex-col items-center justify-center px-4 text-center space-y-4">
              <EmptyAssessment />
              <span className="text-muted-foreground text-lg">No tests found.</span>
            </div>
          )}

          {loading && (
            <div className="text-center text-muted-foreground py-8">Loading assessments...</div>
          )}

          {loadingMore && (
            <div className="py-4 flex flex-col items-center gap-2">
              <div className="text-sm text-muted-foreground">
                Loading more...
              </div>
              <DashboardLoader />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
