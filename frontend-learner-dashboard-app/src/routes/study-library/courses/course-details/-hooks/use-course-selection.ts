import { useCallback, useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toTitleCase } from "@/lib/utils";
import {
  hasChildSubgroups,
  getBatchOptionsForSessionLevel,
  resolvePackageSessionId,
} from "@/routes/courses/course-details/-utils/helper";
import type { BatchForSessionType } from "@/stores/study-library/institute-schema";
import type { EnrolledSession } from "@/hooks/use-enrollment-status";
import type { CourseDetailsFormValues } from "../-components/course-details-schema";
import type {
  PackageSessionSummary,
  SelectOption,
} from "../-utils/course-details-types";

type WatchedSessions = CourseDetailsFormValues["courseData"]["sessions"];

// Owns the session/level/batch selection state and its resolution to a
// packageSessionId. Resolution sources, in priority order: URL
// packageSessionId → batches API → course-init package_sessions fallback
// (covers empty batches and "DEFAULT" vs UUID id mismatches).
export function useCourseSelection({
  form,
  courseId,
  urlPackageSessionId,
  selectedTab,
  fetchedBatches,
  isBatchesFetched,
  courseDetailsData,
  enrolledSessions,
  enrolledPackageSessionsForCourse,
  isEnrollmentLoading,
  watchedSessions,
}: {
  form: UseFormReturn<CourseDetailsFormValues>;
  courseId: string | undefined;
  urlPackageSessionId: string | undefined;
  selectedTab: string;
  fetchedBatches: BatchForSessionType[];
  isBatchesFetched: boolean;
  courseDetailsData: unknown;
  enrolledSessions: EnrolledSession[];
  enrolledPackageSessionsForCourse: PackageSessionSummary[];
  isEnrollmentLoading: boolean;
  watchedSessions: WatchedSessions;
}) {
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [levelOptions, setLevelOptions] = useState<SelectOption[]>([]);
  const [packageSessionIdForCurrentLevel, setPackageSessionIdForCurrentLevel] =
    useState<string | null>(null);

  // Map session/level to packageSessionId when batches or selections change.
  // Uses batches API when available; falls back to course-init's package_sessions when
  // batches are empty or session/level IDs don't match (e.g. "DEFAULT" vs UUID), so content still loads.
  // "URL" = page query params (e.g. ?courseId=...&packageSessionId=...) from React Router, not an API URL.
  useEffect(() => {
    // 1) Apply URL packageSessionId only when it matches current selection, or on initial load when selection not yet set.
    //    If user has changed session/level/subgroup, URL param is stale – fall through to block 2 to resolve from selection.
    if (urlPackageSessionId && fetchedBatches.length > 0) {
      const targetBatch = fetchedBatches.find(
        (b) => b.id === urlPackageSessionId,
      );
      const urlMatchesCurrentSelection =
        targetBatch &&
        targetBatch.session?.id === selectedSession &&
        targetBatch.level?.id === selectedLevel &&
        (!selectedBatchId || targetBatch.id === selectedBatchId);

      if (
        targetBatch?.session?.id &&
        targetBatch?.level?.id &&
        urlMatchesCurrentSelection
      ) {
        setPackageSessionIdForCurrentLevel(targetBatch.id);
        setSelectedBatchId(targetBatch.id);
        return;
      }
      // Initial load: no session/level selected yet – sync from URL once
      if (
        targetBatch?.session?.id &&
        targetBatch?.level?.id &&
        !selectedSession &&
        !selectedLevel
      ) {
        setPackageSessionIdForCurrentLevel(targetBatch.id);
        setSelectedBatchId(targetBatch.id);
        setSelectedSession(targetBatch.session.id);
        setSelectedLevel(targetBatch.level.id);
        const sessions = form.getValues("courseData")?.sessions || [];
        const selectedSessionData = sessions.find(
          (s) => s.sessionDetails.id === targetBatch.session.id,
        );
        if (selectedSessionData) {
          setLevelOptions(
            selectedSessionData.levelDetails.map((level) => ({
              _id: level.id,
              value: level.id,
              label: level.name,
            })),
          );
        }
        return;
      }
      // URL doesn't match current selection – do not return; block 2 will resolve from selectedSession/selectedLevel/selectedBatchId
    }

    // When batches empty but URL has packageSessionId, trust URL.
    // Also try to resolve session/level from course-init data so dropdowns populate correctly.
    if (urlPackageSessionId && fetchedBatches.length === 0) {
      setPackageSessionIdForCurrentLevel(urlPackageSessionId);
      // Try to find session/level for this packageSessionId from courseDetailsData
      try {
        const initData = courseDetailsData as
          | {
              package_sessions?: Array<{
                id: string;
                session?: { id: string };
                level?: { id: string };
              }>;
              sessions?: Array<{
                session_dto?: { id: string };
                level_with_details?: Array<{ id: string; name?: string }>;
              }>;
            }
          | null
          | undefined;
        const ps = initData?.package_sessions?.find(
          (p) => p.id === urlPackageSessionId,
        );
        if (ps?.session?.id && !selectedSession) {
          setSelectedSession(ps.session.id);
        }
        if (ps?.level?.id && !selectedLevel) {
          setSelectedLevel(ps.level.id);
          const sessionData = initData?.sessions?.find(
            (s) => s.session_dto?.id === ps.session?.id,
          );
          if (sessionData?.level_with_details) {
            setLevelOptions(
              sessionData.level_with_details.map((l) => ({
                _id: l.id,
                value: l.id,
                label: l.name ?? l.id,
              })),
            );
          }
        }
      } catch {
        /* ignore */
      }
      return;
    }

    // 2) From batches: use resolvePackageSessionId (supports subgroup selection)
    if (fetchedBatches.length > 0) {
      const packageSessionId = resolvePackageSessionId(
        fetchedBatches,
        selectedSession,
        selectedLevel,
        courseId || "",
        selectedBatchId || undefined,
      );
      if (packageSessionId) {
        setPackageSessionIdForCurrentLevel(packageSessionId);
        if (
          !selectedBatchId &&
          hasChildSubgroups(
            fetchedBatches,
            selectedSession,
            selectedLevel,
            courseId || "",
          )
        ) {
          setSelectedBatchId(packageSessionId);
        }
        if (import.meta.env.MODE !== "production") {
          console.info("[CourseDetailsPage] mapping result", {
            selectedSession,
            selectedLevel,
            selectedBatchId,
            courseId,
            packageSessionIdForCurrentLevel: packageSessionId,
          });
        }
        return;
      }
      const byCourseAndSession = fetchedBatches.find(
        (b) =>
          b.package_dto?.id === (courseId || "") &&
          b.session?.id === selectedSession,
      );
      const byCourseOnly = fetchedBatches.find(
        (b) => b.package_dto?.id === (courseId || ""),
      );
      const chosen = byCourseAndSession || byCourseOnly;
      if (chosen?.id) {
        setPackageSessionIdForCurrentLevel(chosen.id);
        if (!selectedSession && chosen.session?.id) {
          setSelectedSession(chosen.session.id);
        }
        return;
      }
    }

    // 3) Fallback: use course-init's package_sessions so content loads even when
    // batches are empty or session/level IDs don't match (e.g. "DEFAULT" in init, UUIDs in batches).
    // IMPORTANT: Skip this fallback if enrollment data is still loading — setting the wrong
    // level triggers a module fetch with wrong subjects that blocks the correct fetch later.
    if (isEnrollmentLoading) {
      return;
    }
    try {
      const data = courseDetailsData as
        | {
            package_sessions?: PackageSessionSummary[];
            sessions?: Array<{
              session_dto?: { id: string };
              level_with_details?: Array<{ id: string; name?: string }>;
            }>;
          }
        | null
        | undefined;
      const packageSessions = Array.isArray(data?.package_sessions)
        ? data.package_sessions
        : undefined;
      if (packageSessions && packageSessions.length > 0 && courseId) {
        // Prefer package_session that matches current course (and optionally session/level)
        const forCourse = packageSessions.filter(
          (ps) => !ps.package_dto?.id || ps.package_dto.id === courseId,
        );
        const list = forCourse.length > 0 ? forCourse : packageSessions;
        // Priority: 1) URL packageSessionId, 2) current session+level selection, 3) first item
        const urlMatch = urlPackageSessionId
          ? list.find((ps) => ps.id === urlPackageSessionId)
          : null;
        const selectionMatch =
          selectedSession && selectedLevel
            ? list.find(
                (ps) =>
                  ps.session?.id === selectedSession &&
                  ps.level?.id === selectedLevel,
              )
            : null;
        const toUse = urlMatch ?? selectionMatch ?? list[0];
        if (toUse?.id) {
          setPackageSessionIdForCurrentLevel(toUse.id);
          // Set both session and level so dropdowns reflect the correct selection
          if (toUse.session?.id && !selectedSession) {
            setSelectedSession(toUse.session.id);
          }
          if (toUse.level?.id && !selectedLevel) {
            setSelectedLevel(toUse.level.id);
            // Populate the level options dropdown for this session
            const sessionData = data?.sessions?.find(
              (s) => s.session_dto?.id === toUse.session?.id,
            );
            if (sessionData?.level_with_details) {
              setLevelOptions(
                sessionData.level_with_details.map((l) => ({
                  _id: l.id,
                  value: l.id,
                  label: l.name ?? l.id,
                })),
              );
            }
          }
          if (import.meta.env.MODE !== "production") {
            console.info(
              "[CourseDetailsPage] packageSessionId from course-init fallback",
              {
                packageSessionId: toUse.id,
                fromUrlMatch: !!urlMatch,
                fromSelectionMatch: !!selectionMatch,
              },
            );
          }
        }
      }
    } catch (e) {
      if (import.meta.env.MODE !== "production") {
        console.warn("[CourseDetailsPage] course-init fallback error", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fetchedBatches,
    selectedSession,
    selectedLevel,
    selectedBatchId,
    courseId,
    urlPackageSessionId,
    courseDetailsData,
    enrolledPackageSessionsForCourse,
    isEnrollmentLoading,
  ]);

  // Convert sessions to select options format - filter to enrolled sessions for this course
  const sessionOptions = useMemo(() => {
    const sessions = watchedSessions || [];

    // If user has enrollments for this course, filter sessions to enrolled ones
    if (enrolledPackageSessionsForCourse.length > 0) {
      const enrolledSessionIds = enrolledPackageSessionsForCourse
        .map((ps) => ps.session?.id)
        .filter(Boolean);
      const filteredSessions = sessions.filter((session) =>
        enrolledSessionIds.includes(session.sessionDetails.id),
      );

      return filteredSessions.map((session) => ({
        _id: session.sessionDetails.id,
        value: session.sessionDetails.id,
        label: toTitleCase(session.sessionDetails.session_name),
      }));
    } else {
      // For ALL tab, show all sessions
      return sessions.map((session) => ({
        _id: session.sessionDetails.id,
        value: session.sessionDetails.id,
        label: toTitleCase(session.sessionDetails.session_name),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab, watchedSessions, enrolledSessions]);

  const shouldShowBatchDropdown = useMemo(
    () =>
      hasChildSubgroups(
        fetchedBatches,
        selectedSession,
        selectedLevel,
        courseId || "",
      ),
    [fetchedBatches, selectedSession, selectedLevel, courseId],
  );

  const batchOptions = useMemo(
    () =>
      getBatchOptionsForSessionLevel(
        fetchedBatches,
        selectedSession,
        selectedLevel,
        courseId || "",
      ),
    [fetchedBatches, selectedSession, selectedLevel, courseId],
  );

  // Update level options when session changes - filter based on selectedTab
  const handleSessionChange = useCallback(
    async (sessionId: string) => {
      // Wait for enrollment data to be loaded before processing
      if (isEnrollmentLoading) {
        return;
      }

      setSelectedSession(sessionId);
      setSelectedBatchId("");
      const sessions = form.getValues("courseData")?.sessions || [];
      const selectedSessionData = sessions.find(
        (session) => session.sessionDetails.id === sessionId,
      );

      if (selectedSessionData) {
        let newLevelOptions;

        // Find enrolled package_sessions matching this session (source of truth for levels)
        const matchingPkgSessions = enrolledPackageSessionsForCourse.filter(
          (ps) => ps.session?.id === sessionId,
        );

        if (matchingPkgSessions.length > 0) {
          // User is enrolled — show only enrolled levels
          const enrolledLevelIds = matchingPkgSessions
            .map((ps) => ps.level?.id)
            .filter(Boolean);
          const filteredLevels = selectedSessionData.levelDetails.filter(
            (level) => enrolledLevelIds.includes(level.id),
          );

          newLevelOptions =
            filteredLevels.length > 0
              ? filteredLevels.map((level) => ({
                  _id: level.id,
                  value: level.id,
                  label: level.name,
                }))
              : selectedSessionData.levelDetails.map((level) => ({
                  _id: level.id,
                  value: level.id,
                  label: level.name,
                }));
        } else {
          // User not enrolled in this course/session — show all levels (browsing)
          newLevelOptions = selectedSessionData.levelDetails.map((level) => ({
            _id: level.id,
            value: level.id,
            label: level.name,
          }));
        }

        setLevelOptions(newLevelOptions);

        // Auto-select level from enrolled data or first available
        if (matchingPkgSessions.length > 0) {
          // Prefer the enrolled level
          const enrolledLevelId = matchingPkgSessions[0]?.level?.id;
          const exists = enrolledLevelId
            ? newLevelOptions.some((l) => l.value === enrolledLevelId)
            : false;
          const choosingLevelId = exists
            ? enrolledLevelId!
            : newLevelOptions[0]?.value || "";
          setSelectedLevel(choosingLevelId);
          if (import.meta.env.MODE !== "production") {
            console.info("[CourseDetailsPage] handleSessionChange", {
              selectedSession: sessionId,
              newLevelOptions: newLevelOptions.map((l) => l.value),
              choosingLevelId,
            });
          }
        } else if (newLevelOptions.length > 0 && newLevelOptions[0]?.value) {
          // Browsing mode — select first available level
          setSelectedLevel(newLevelOptions[0].value);
          if (import.meta.env.MODE !== "production") {
            console.info("[CourseDetailsPage] handleSessionChange (browsing)", {
              selectedSession: sessionId,
              choosingLevelId: newLevelOptions[0].value,
            });
          }
        } else {
          setSelectedLevel("");
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      form,
      selectedTab,
      enrolledSessions,
      isEnrollmentLoading,
      enrolledPackageSessionsForCourse,
    ],
  );

  // Handle level change - clear expanded items and reset state
  const handleLevelChange = (levelId: string) => {
    setSelectedLevel(levelId);
    setSelectedBatchId("");
    if (import.meta.env.MODE !== "production") {
      console.info("[CourseDetailsPage] handleLevelChange", { levelId });
    }
  };

  const handleBatchChange = (batchId: string) => {
    setSelectedBatchId(batchId);
  };

  // Set initial session and its levels - auto-select if only one option
  useEffect(() => {
    // Wait for enrollment data to be loaded before auto-selecting
    if (isEnrollmentLoading) {
      return;
    }

    // If the URL carries a packageSessionId, wait until batches have been fetched so
    // the URL-sync effect above can set the correct session/level first.
    // Without this guard the auto-select fires before batches resolve and sets the
    // wrong level (first in list), then the URL-sync "initial load" branch is skipped
    // because selectedSession/selectedLevel are already populated.
    if (urlPackageSessionId && !isBatchesFetched) {
      return;
    }

    if (sessionOptions.length > 0 && sessionOptions[0]?.value) {
      if (!selectedSession) {
        // No session selected yet — auto-select first session
        const initialSessionId = sessionOptions[0].value;
        handleSessionChange(initialSessionId);
        if (import.meta.env.MODE !== "production") {
          console.info("[CourseDetailsPage] auto-select session", {
            initialSessionId,
            sessionOptions: sessionOptions.map((s) => s.value),
          });
        }
      } else if (!selectedLevel) {
        // Session was set outside handleSessionChange (e.g. course-init fallback)
        // but level was never set — call handleSessionChange to populate level options and select a level
        handleSessionChange(selectedSession);
        if (import.meta.env.MODE !== "production") {
          console.info(
            "[CourseDetailsPage] auto-select level for existing session",
            {
              selectedSession,
            },
          );
        }
      }
    }
  }, [
    sessionOptions,
    selectedSession,
    selectedLevel,
    handleSessionChange,
    isEnrollmentLoading,
    isBatchesFetched,
    urlPackageSessionId,
  ]);

  // Re-filter levels when enrollment data becomes available after initial selection
  useEffect(() => {
    if (!selectedSession || enrolledPackageSessionsForCourse.length === 0)
      return;

    // Directly filter and set levels here (bypassing handleSessionChange which may be
    // blocked by isEnrollmentLoading or have stale closure)
    const sessions = form.getValues("courseData")?.sessions || [];
    const sessionData = sessions.find(
      (s) => s.sessionDetails?.id === selectedSession,
    );
    if (!sessionData) return;

    const matchingPkgSessions = enrolledPackageSessionsForCourse.filter(
      (ps) => ps.session?.id === selectedSession,
    );
    const enrolledLevelIds = matchingPkgSessions
      .map((ps) => ps.level?.id)
      .filter(Boolean);

    if (enrolledLevelIds.length > 0) {
      const filteredLevels = sessionData.levelDetails.filter((level) =>
        enrolledLevelIds.includes(level.id),
      );
      const levelsToShow =
        filteredLevels.length > 0 ? filteredLevels : sessionData.levelDetails;

      setLevelOptions(
        levelsToShow.map((level) => ({
          _id: level.id,
          value: level.id,
          label: level.name,
        })),
      );
      // Set selected level to enrolled level — but only when the URL doesn't lock us to a
      // specific packageSessionId. If the user navigated here via a catalog card (URL has
      // packageSessionId), respect that choice; don't force-switch to the default enrolled level.
      const enrolledLevelId = enrolledLevelIds[0] as string;
      if (!urlPackageSessionId) {
        if (!selectedLevel || !enrolledLevelIds.includes(selectedLevel)) {
          setSelectedLevel(enrolledLevelId);
        }
        // Also sync packageSessionId for the enrolled level
        const enrolledPkgSession = matchingPkgSessions.find(
          (ps) => ps.level?.id === enrolledLevelId,
        );
        if (enrolledPkgSession?.id) {
          setPackageSessionIdForCurrentLevel(enrolledPkgSession.id);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enrolledPackageSessionsForCourse,
    selectedSession,
    watchedSessions,
    urlPackageSessionId,
  ]);

  // Trace selection state changes
  useEffect(() => {
    if (import.meta.env.MODE !== "production") {
      console.info("[CourseDetailsPage] selection state", {
        selectedSession,
        selectedLevel,
        packageSessionIdForCurrentLevel,
      });
    }
  }, [selectedSession, selectedLevel, packageSessionIdForCurrentLevel]);

  return {
    selectedSession,
    selectedLevel,
    selectedBatchId,
    levelOptions,
    packageSessionIdForCurrentLevel,
    sessionOptions,
    batchOptions,
    shouldShowBatchDropdown,
    handleSessionChange,
    handleLevelChange,
    handleBatchChange,
  };
}
