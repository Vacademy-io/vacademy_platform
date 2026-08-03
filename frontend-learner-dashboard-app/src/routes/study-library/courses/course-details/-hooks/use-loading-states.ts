import { useCallback, useEffect, useMemo, useState } from "react";

export type CourseDetailsLoadingKey =
  | "instituteDetails"
  | "courseDetails"
  | "slideCount"
  | "modulesData"
  | "ratingsData"
  | "userData";

// Aggregates the per-source loading flags into the single page-level loader
// gate. The page shows DashboardLoader until every source has finished its
// first load.
export function useCourseDetailsLoadingStates() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStates, setLoadingStates] = useState<
    Record<CourseDetailsLoadingKey, boolean>
  >({
    instituteDetails: false,
    courseDetails: false,
    slideCount: false,
    modulesData: false,
    ratingsData: false,
    userData: false,
  });

  const updateLoadingState = useCallback(
    (key: CourseDetailsLoadingKey, value: boolean) => {
      setLoadingStates((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const isAllLoadingComplete = useMemo(
    () => Object.values(loadingStates).every((state) => !state),
    [loadingStates],
  );

  useEffect(() => {
    if (isAllLoadingComplete) {
      setIsLoading(false);
    }
  }, [isAllLoadingComplete]);

  const handleModulesLoadingChange = useCallback(
    (loading: boolean) => {
      updateLoadingState("modulesData", loading);
    },
    [updateLoadingState],
  );

  const handleRatingsLoadingChange = useCallback(
    (loading: boolean) => {
      updateLoadingState("ratingsData", loading);
    },
    [updateLoadingState],
  );

  return {
    isLoading,
    updateLoadingState,
    handleModulesLoadingChange,
    handleRatingsLoadingChange,
  };
}
