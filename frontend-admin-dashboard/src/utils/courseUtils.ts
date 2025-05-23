import { SubjectType, useStudyLibraryStore, CourseWithSessionsType } from "@/stores/study-library/use-study-library-store";

// Regular function that can be used anywhere
export const getSubjectsByLevelAndSession = (
  data: CourseWithSessionsType[] | null,
  levelId: string,
  sessionId: string
): SubjectType[] => {
  if (!data) return [];

  // Find the session that matches the sessionId
  const matchingSession = data.flatMap(course =>
    course.sessions.find(session => session.session_dto.id === sessionId)
  ).find(Boolean);

  if (!matchingSession) {
    return [];
  }

  // Find the level that matches the levelId
  const matchingLevel = matchingSession.level_with_details.find(
    level => level.id === levelId
  );

  if (!matchingLevel) {
    return [];
  }

  // Return the subjects for the matching level
  return matchingLevel.subjects;
};

// Hook that can be used in components
export const useGetSubjectsByLevelAndSession = (
  levelId: string,
  sessionId: string
): SubjectType[] => {
  const { studyLibraryData } = useStudyLibraryStore();
  return getSubjectsByLevelAndSession(studyLibraryData, levelId, sessionId);
};
