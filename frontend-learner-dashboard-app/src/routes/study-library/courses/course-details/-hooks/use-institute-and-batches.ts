import { useEffect, useRef, useState } from "react";
import { getInstituteId } from "@/constants/helper";
import { fetchInstituteDetailsCached } from "@/services/institute-details-cached";
import { useInstituteDetailsStore } from "@/stores/study-library/useInstituteDetails";
import type {
  BatchForSessionType,
  InstituteDetailsType,
} from "@/stores/study-library/institute-schema";
import type { CourseDetailsLoadingKey } from "./use-loading-states";

// Fetches institute details (into the institute store) and this course's
// batches ONCE per mount, in parallel. Batches drive session/level →
// packageSessionId mapping; isBatchesFetched lets the selection effects wait
// for them when the URL carries a packageSessionId (avoids the race that
// briefly selects the wrong level).
export function useInstituteAndBatches({
  instituteId,
  courseId,
  updateLoadingState,
}: {
  instituteId: string | null;
  courseId: string | undefined;
  updateLoadingState: (key: CourseDetailsLoadingKey, value: boolean) => void;
}) {
  const { setInstituteDetails } = useInstituteDetailsStore();
  const [fetchedBatches, setFetchedBatches] = useState<BatchForSessionType[]>(
    [],
  );
  const hasFetchedRef = useRef(false);
  const [isBatchesFetched, setIsBatchesFetched] = useState(false);

  useEffect(() => {
    // Skip if already fetched for this courseId
    if (hasFetchedRef.current) return;

    const fetchInstituteAndBatches = async () => {
      updateLoadingState("instituteDetails", true);
      const fetchedInstituteId = instituteId || (await getInstituteId());

      if (!fetchedInstituteId) {
        updateLoadingState("instituteDetails", false);
        return;
      }

      try {
        const instituteDetailsPromise =
          fetchInstituteDetailsCached<InstituteDetailsType>(fetchedInstituteId);

        const batchesPromise = courseId
          ? (async () => {
              const { fetchBatchesForCourse } =
                await import("@/services/courseBatches");
              return fetchBatchesForCourse(courseId);
            })()
          : Promise.resolve([]);

        const [instituteData, batches] = await Promise.all([
          instituteDetailsPromise,
          batchesPromise,
        ]);

        setInstituteDetails(instituteData);
        setFetchedBatches(batches);
        hasFetchedRef.current = true;
        setIsBatchesFetched(true);

        if (import.meta.env.MODE !== "production") {
          console.info("[CourseDetailsPage] Data fetched", {
            batchesCount: batches.length,
            courseId,
          });
        }
      } catch (error) {
        console.error("Failed to fetch institute details or batches", error);
      } finally {
        updateLoadingState("instituteDetails", false);
      }
    };

    if (instituteId) {
      fetchInstituteAndBatches();
    }
  }, [instituteId, courseId, updateLoadingState, setInstituteDetails]);

  return { fetchedBatches, isBatchesFetched };
}
