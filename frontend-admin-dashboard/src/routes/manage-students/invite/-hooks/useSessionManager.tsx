// import { useInviteFormContext } from "@/routes/students/invite/-context/useInviteFormContext";
// import {
//     LearnerChoiceSession,
//     PreSelectedSession,
//     SelectionMode,
//     PreSelectedCourse,
//     LearnerChoiceCourse,
// } from "@/routes/students/invite/-schema/InviteFormSchema";
// import { useInstituteDetailsStore } from "@/stores/students/students-list/useInstituteDetailsStore";

// // Type guards
// // First, let's improve the type guard to be more specific
// // eslint-disable-next-line
// function isPreSelectedCourse(course: any): course is PreSelectedCourse {
//     return course !== null && typeof course === "object" && "preSelectedSessions" in course;
// }

// // function isLearnerChoiceCourse(course: any): course is LearnerChoiceCourse {
// //   return 'learnerChoiceSessions' in course;
// // }

// export function useSessionManager(courseId: string, isCourseCompulsory: boolean) {
//     const { form } = useInviteFormContext();
//     const { getValues, setValue } = form;
//     const { getSessionFromPackage } = useInstituteDetailsStore();

//     // Get the course object and its path
//     const getCourse = () => {
//         const batch = getValues("batches");

//         if (isCourseCompulsory) {
//             // PreSelectedCourse path
//             const courses = batch.preSelectedCourses;
//             const courseIndex = courses?.findIndex((c) => c.id === courseId);
//             if (courseIndex === -1 || courseIndex === undefined)
//                 return { course: null, path: null };

//             const course = courses?.[courseIndex] as PreSelectedCourse;
//             const coursePath = `batches.preSelectedCourses.${courseIndex}`;

//             return { course, path: coursePath };
//         } else {
//             // LearnerChoiceCourse path
//             const courses = batch.learnerChoiceCourses;
//             const courseIndex = courses?.findIndex((c) => c.id === courseId);
//             if (courseIndex === -1 || courseIndex === undefined)
//                 return { course: null, path: null };

//             const course = courses?.[courseIndex] as LearnerChoiceCourse;
//             const coursePath = `batches.learnerChoiceCourses.${courseIndex}`;

//             return { course, path: coursePath };
//         }
//     };

//     // Get all available sessions for adding to this course
//     const getAllAvailableSessions = () => {
//         const { course } = getCourse();
//         if (!course) return [];

//         // Get all sessions from the institute store
//         const allSessions = getSessionFromPackage({ courseId: course.id });

//         // Get lists of already selected sessions
//         let preSelectedSessions: Array<{ id: string; name: string }> = [];
//         const learnerChoiceSessions = course.learnerChoiceSessions || [];

//         // If it's a PreSelectedCourse, get the preSelectedSessions
//         if (isPreSelectedCourse(course)) {
//             preSelectedSessions = course.preSelectedSessions || [];
//         }

//         // Filter out sessions that are already selected in either array
//         const availableSessions = allSessions.filter((session) => {
//             const isInPreSelected = preSelectedSessions.some((s) => s.id === session.id);
//             const isInLearnerChoice = learnerChoiceSessions.some((s) => s.id === session.id);
//             return !isInPreSelected && !isInLearnerChoice;
//         });

//         return availableSessions;
//     };

//     // Get all sessions currently selected for this course
//     //   const getAllSelectedSessions = () => {
//     //     const { course } = getCourse();
//     //     if (!course) return [];

//     //     let sessions = [];

//     //     // For preSelectedCourse, get both types of sessions
//     //     if (isPreSelectedCourse(course)) {
//     //       if (course?.preSelectedSessions) {
//     //         sessions = [...sessions, ...course?.preSelectedSessions];
//     //       }
//     //       if (course?.learnerChoiceSessions) {
//     //         sessions = [...sessions, ...course?.learnerChoiceSessions];
//     //       }
//     //     }
//     //     // For learnerChoiceCourse, get only learnerChoiceSessions
//     //     else if (isLearnerChoiceCourse(course) && course?.learnerChoiceSessions) {
//     //       sessions = [...sessions, ...course?.learnerChoiceSessions];
//     //     }

//     //     return sessions;
//     //   };

//     // Get length of learnerChoiceSessions
//     const getLearnerChoiceSessionsLength = () => {
//         const { course } = getCourse();
//         if (!course) return 0;

//         // Both types of courses can have learnerChoiceSessions
//         return course?.learnerChoiceSessions?.length || 0;
//     };

//     // Get length of preSelectedSessions - only applicable for preSelectedCourses
//     const getPreSelectedSessionsLength = () => {
//         const { course } = getCourse();
//         if (!course || !isPreSelectedCourse(course)) return 0;

//         return course?.preSelectedSessions?.length || 0;
//     };

//     // Add or update a session
//     const addOrUpdateSession = (
//         newSession: Partial<LearnerChoiceSession | PreSelectedSession>,
//         selectionMode: SelectionMode,
//         sessionIdToReplace?: string,
//     ) => {
//         const { course, path } = getCourse();
//         if (!course || !path) return false;

//         // If sessionIdToReplace is provided, delete that session first
//         if (sessionIdToReplace) {
//             deleteSession(sessionIdToReplace);
//         }

//         // For institute selection mode (preSelectedSessions)
//         // Only preSelectedCourses can have preSelectedSessions
//         if (selectionMode === "institute" && isPreSelectedCourse(course)) {
//             // Add to preSelectedSessions array
//             const currentSessions = [...(course?.preSelectedSessions || [])];

//             // Create a session object with all required fields
//             const sessionToAdd: PreSelectedSession = {
//                 id: newSession.id || "",
//                 name: newSession.name || "",
//                 maxLevels: newSession.maxLevels || 1,
//                 levelSelectionMode: newSession.levelSelectionMode || "institute",
//                 learnerChoiceLevels: newSession.learnerChoiceLevels || [],
//                 preSelectedLevels: (newSession as PreSelectedSession).preSelectedLevels || [],
//             };

//             currentSessions.push(sessionToAdd);
//             // eslint-disable-next-line
//             setValue(`${path}.preSelectedSessions` as any, currentSessions);
//             return true;
//         }
//         // For student selection mode (learnerChoiceSessions)
//         // Both types of courses can have learnerChoiceSessions
//         else if (selectionMode === "student") {
//             // Add to learnerChoiceSessions
//             const currentSessions = [...(course?.learnerChoiceSessions || [])];

//             // Create a session object with all required fields
//             const sessionToAdd: LearnerChoiceSession = {
//                 id: newSession.id || "",
//                 name: newSession.name || "",
//                 maxLevels: newSession.maxLevels || 1,
//                 levelSelectionMode: newSession.levelSelectionMode || "student",
//                 learnerChoiceLevels: newSession.learnerChoiceLevels || [],
//             };

//             currentSessions.push(sessionToAdd);
//             // eslint-disable-next-line
//             setValue(`${path}.learnerChoiceSessions` as any, currentSessions);
//             return true;
//         }

//         return false;
//     };

//     // Delete a session with ID
//     const deleteSession = (sessionId: string) => {
//         const { course, path } = getCourse();
//         if (!course || !path) return false;

//         let deleted = false;

//         // Check preSelectedSessions if course is preSelectedCourse
//         if (isPreSelectedCourse(course) && course?.preSelectedSessions) {
//             const currentPreSelectedSessions = (course && [...course.preSelectedSessions]) || [];
//             const updatedPreSelectedSessions = currentPreSelectedSessions.filter(
//                 (session) => session.id !== sessionId,
//             );

//             if (currentPreSelectedSessions.length !== updatedPreSelectedSessions.length) {
//                 // eslint-disable-next-line
//                 setValue(`${path}.preSelectedSessions` as any, updatedPreSelectedSessions);
//                 deleted = true;
//             }
//         }

//         // Check learnerChoiceSessions for both course types
//         if (course?.learnerChoiceSessions) {
//             const currentLearnerChoiceSessions =
//                 (course && [...course.learnerChoiceSessions]) || [];
//             const updatedLearnerChoiceSessions = currentLearnerChoiceSessions.filter(
//                 (session) => session.id !== sessionId,
//             );

//             if (currentLearnerChoiceSessions.length !== updatedLearnerChoiceSessions.length) {
//                 // eslint-disable-next-line
//                 setValue(`${path}.learnerChoiceSessions` as any, updatedLearnerChoiceSessions);
//                 deleted = true;
//             }
//         }

//         return deleted;
//     };

//     // Set max sessions
//     const setMaxSessions = (newMaxSessions: number) => {
//         const { path } = getCourse();
//         if (!path) return false;
//         // eslint-disable-next-line
//         setValue(`${path}.maxSessions` as any, newMaxSessions);
//         return true;
//     };

//     // Change session selection mode
//     const changeSessionSelectionMode = (newMode: SelectionMode) => {
//         const { path } = getCourse();
//         if (!path) return false;
//         // eslint-disable-next-line
//         setValue(`${path}.sessionSelectionMode` as any, newMode);
//         return true;
//     };

//     // Find a session by ID across both types
//     const findSessionById = (sessionId: string) => {
//         const { course } = getCourse();
//         if (!course) return null;

//         // Check in preSelectedSessions if course is preSelectedCourse
//         if (isPreSelectedCourse(course) && course?.preSelectedSessions) {
//             const session = course?.preSelectedSessions.find((s) => s.id === sessionId);
//             if (session) return { session, isPreSelected: true };
//         }

//         // Check in learnerChoiceSessions for both course types
//         if (course?.learnerChoiceSessions) {
//             const session = course?.learnerChoiceSessions.find((s) => s.id === sessionId);
//             if (session) return { session, isPreSelected: false };
//         }

//         return null;
//     };

//     const getCurrentSessions = () => {
//         const { course } = getCourse();
//         return {
//             preSelectedSessions:
//                 course && isPreSelectedCourse(course) ? course.preSelectedSessions || [] : [],
//             learnerChoiceSessions: course ? course.learnerChoiceSessions || [] : [],
//         };
//     };

//     return {
//         getCourse,
//         getAllAvailableSessions,
//         // getAllSelectedSessions,
//         getLearnerChoiceSessionsLength,
//         getPreSelectedSessionsLength,
//         addOrUpdateSession,
//         deleteSession,
//         setMaxSessions,
//         changeSessionSelectionMode,
//         findSessionById,
//         getCurrentSessions,
//     };
// }
