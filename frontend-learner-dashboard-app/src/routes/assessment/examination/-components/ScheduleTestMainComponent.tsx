import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useEffect, useState, useRef, useCallback } from "react";
import ScheduleTestTabList from "./ScheduleTestTabList";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { assessmentTypes, Assessment } from "@/types/assessment";
import { fetchAssessmentData } from "../-utils.ts/useFetchAssessment";
import { AssessmentCard } from "../-components/AssessmentCard";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { EmptyState } from "@/components/design-system/states";
import { Exam } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

export const ScheduleTestMainComponent = ({
  assessment_types,
}: {
  assessment_types: "HOMEWORK" | "ASSESSMENT";
}) => {
  const { t } = useTranslation("assessment");
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

        // Defense-in-depth: even with the upstream catch fixed, a missing
        // or malformed payload would crash inside React's setState updater
        // (a hard render error, not a recoverable toast). Bail instead.
        if (!data || !Array.isArray(data.content)) {
          return;
        }

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
    const nextHeading =
      assessment_types === "ASSESSMENT"
        ? t("scheduleTest.navHeading.assessment")
        : t("scheduleTest.navHeading.homework");
    setNavHeading(nextHeading);
    fetchAllTabsData();
  }, [assessment_types, fetchAllTabsData, setNavHeading, t]);

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
            <EmptyState
              icon={Exam}
              title={
                selectedTab === assessmentTypes.LIVE
                  ? t("scheduleTest.empty.live.title")
                  : selectedTab === assessmentTypes.UPCOMING
                    ? t("scheduleTest.empty.upcoming.title")
                    : t("scheduleTest.empty.past.title")
              }
              description={
                selectedTab === assessmentTypes.LIVE
                  ? t("scheduleTest.empty.live.description")
                  : selectedTab === assessmentTypes.UPCOMING
                    ? t("scheduleTest.empty.upcoming.description")
                    : t("scheduleTest.empty.past.description")
              }
              action={
                selectedTab === assessmentTypes.LIVE
                  ? {
                      label: t("scheduleTest.empty.live.action"),
                      onClick: () => setSelectedTab(assessmentTypes.UPCOMING),
                    }
                  : undefined
              }
            />
          )}

          {loading && (
            <div className="text-center text-muted-foreground py-8">{t("scheduleTest.loading.assessments")}</div>
          )}

          {loadingMore && (
            <div className="py-4 flex flex-col items-center gap-2">
              <div className="text-sm text-muted-foreground">
                {t("scheduleTest.loading.more")}
              </div>
              <DashboardLoader />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
