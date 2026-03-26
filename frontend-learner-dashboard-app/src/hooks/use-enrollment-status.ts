import { useState, useEffect, useCallback } from "react";
import { Preferences } from "@capacitor/preferences";
import { hasUserDonated } from "@/services/user-enrollment-status";
import { useInstituteDetailsStore } from "@/stores/study-library/useInstituteDetails";

export interface EnrolledSession {
  id: string;
  session: {
    id: string;
    session_name: string;
    status: string;
    start_date: string;
  };
  level: {
    id: string;
    level_name: string;
    duration_in_days: number | null;
    thumbnail_id: string | null;
  };
  start_time: string | null;
  status: string;
  package_dto: {
    id: string;
    package_name: string;
    thumbnail_id?: string | null;
  };
}

export const useEnrollmentStatus = (instituteId: string | null) => {
  const [enrolledSessions, setEnrolledSessions] = useState<EnrolledSession[]>(
    [],
  );
  const [userHasDonated, setUserHasDonated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start as true since we're loading on mount
  const [donationCheckCompleted, setDonationCheckCompleted] = useState(false);

  const instituteDetails = useInstituteDetailsStore(
    (state) => state.instituteDetails,
  );

  // Fetch enrolled sessions from "students" in Preferences + institute store
  const fetchEnrolledSessions = useCallback(async () => {
    try {
      // Get student records from Preferences (contains package_session_id per enrollment)
      const studentsResult = await Preferences.get({ key: "students" });
      if (!studentsResult.value) {
        setEnrolledSessions([]);
        setIsLoading(false);
        return;
      }

      const students = JSON.parse(studentsResult.value);
      const studentList = Array.isArray(students) ? students : [students];
      const packageSessionIds = studentList
        .map((s: any) => s.package_session_id)
        .filter(Boolean);

      if (packageSessionIds.length === 0) {
        setEnrolledSessions([]);
        setIsLoading(false);
        return;
      }

      // Get batches_for_sessions from institute store
      const batchesForSessions =
        instituteDetails?.batches_for_sessions ?? [];

      if (batchesForSessions.length > 0) {
        // Match student's package_session_ids against institute's batches
        const matchedSessions = batchesForSessions
          .filter((batch) => packageSessionIds.includes(batch.id))
          .map((batch) => ({
            id: batch.id,
            session: {
              id: batch.session.id,
              session_name: batch.session.session_name,
              status: batch.session.status,
              start_date: batch.session.start_date,
            },
            level: {
              id: batch.level.id,
              level_name: batch.level.level_name,
              duration_in_days: batch.level.duration_in_days,
              thumbnail_id: batch.level.thumbnail_id,
            },
            start_time: batch.start_time,
            status: batch.status,
            package_dto: {
              id: batch.package_dto.id,
              package_name: batch.package_dto.package_name,
              thumbnail_id: batch.package_dto.thumbnail_id ?? null,
            },
          }));

        setEnrolledSessions(matchedSessions);
      } else {
        // Fallback: construct session objects from student records
        // when institute store isn't populated yet
        const fallbackSessions: EnrolledSession[] = studentList
          .filter((s: any) => s.package_session_id)
          .map((s: any) => ({
            id: s.package_session_id,
            session: {
              id: "",
              session_name: s.session_name || "",
              status: "ACTIVE",
              start_date: "",
            },
            level: {
              id: "",
              level_name: s.level_name || "",
              duration_in_days: null,
              thumbnail_id: null,
            },
            start_time: null,
            status: s.status || "ACTIVE",
            package_dto: {
              id: "",
              package_name: s.package_name || "",
              thumbnail_id: null,
            },
          }));
        setEnrolledSessions(fallbackSessions);
      }
    } catch (error) {
      setEnrolledSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [instituteDetails]);

  // Check donation status only when instituteId is available
  const checkDonationStatus = useCallback(async () => {
    if (!instituteId) {
      setUserHasDonated(false);
      return;
    }

    try {
      const hasDonated = await hasUserDonated(instituteId);
      setUserHasDonated(hasDonated);
      setDonationCheckCompleted(true);
    } catch (error) {
      setUserHasDonated(false);
      setDonationCheckCompleted(true);
    }
  }, [instituteId]); // Add instituteId as dependency

  // Add a new enrolled session (optimistic update + refresh from API)
  const addEnrolledSession = useCallback(
    async (newSession: EnrolledSession) => {
      // Optimistic update: add to local state immediately
      setEnrolledSessions((prev) => {
        const exists = prev.some(
          (session) =>
            session.package_dto.id === newSession.package_dto.id &&
            session.session.id === newSession.session.id &&
            session.level.id === newSession.level.id,
        );
        if (exists) return prev;
        return [...prev, newSession];
      });

      // Also update Preferences for backward compatibility
      try {
        const currentSessions = [...(enrolledSessions || []), newSession];
        await Preferences.set({
          key: "sessionList",
          value: JSON.stringify(currentSessions),
        });
      } catch {
        // Silent error handling
      }

      // Refresh from API to get the latest state
      await fetchEnrolledSessions();
    },
    [enrolledSessions, fetchEnrolledSessions],
  );

  // Check if user is enrolled in a specific course
  const isEnrolledInCourse = useCallback(
    (courseId: string, sessionId?: string, levelId?: string) => {
      const result = (enrolledSessions || []).some((session) => {
        const courseMatch = session.package_dto.id === courseId;

        if (sessionId && levelId) {
          return (
            courseMatch &&
            session.session.id === sessionId &&
            session.level.id === levelId
          );
        }

        return courseMatch;
      });

      return result;
    },
    [enrolledSessions],
  ); // Add enrolledSessions dependency

  // Refresh all data
  const refreshData = useCallback(async () => {
    try {
      await Promise.all([fetchEnrolledSessions(), checkDonationStatus()]);
    } catch (error) {
      // Silent error handling
    } finally {
      setIsLoading(false);
    }
  }, [fetchEnrolledSessions, checkDonationStatus]); // Add dependencies

  // Fetch enrolled sessions on mount and when dependencies change
  useEffect(() => {
    fetchEnrolledSessions();
  }, [fetchEnrolledSessions]);

  // Also fetch enrolled sessions when the page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchEnrolledSessions();
      }
    };

    const handleFocus = () => {
      fetchEnrolledSessions();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchEnrolledSessions]);

  // Check donation status when instituteId changes
  useEffect(() => {
    if (instituteId) {
      // Only check donation status if we haven't completed it for this instituteId
      if (!donationCheckCompleted) {
        setIsLoading(true);
        checkDonationStatus();
      }
    } else {
      // Reset donation status when instituteId is null
      setUserHasDonated(false);
      setDonationCheckCompleted(false);
    }
  }, [instituteId, checkDonationStatus, donationCheckCompleted]); // Add donationCheckCompleted as dependency

  // Function to manually refresh donation status (useful after successful donation)
  const refreshDonationStatus = useCallback(async () => {
    if (instituteId) {
      setDonationCheckCompleted(false);
      setIsLoading(true);
      await checkDonationStatus();
    }
  }, [instituteId, checkDonationStatus]);

  return {
    enrolledSessions: enrolledSessions || [],
    userHasDonated: userHasDonated === null ? false : userHasDonated,
    isLoading,
    isEnrolledInCourse,
    addEnrolledSession,
    refreshData,
    refreshDonationStatus,
  };
};
