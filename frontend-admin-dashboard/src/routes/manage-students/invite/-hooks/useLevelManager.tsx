// import { useInviteFormContext } from "@/routes/students/invite/-context/useInviteFormContext";
// import {
//     LevelField,
//     PreSelectedCourse,
//     PreSelectedSession,
//     SelectionMode,
// } from "@/routes/students/invite/-schema/InviteFormSchema";

// // Type guards
// // eslint-disable-next-line
// // eslint-disable-next-line
// function isPreSelectedCourse(course: any): course is PreSelectedCourse {
//     return "preSelectedSessions" in course;
// }

// // eslint-disable-next-line
// // eslint-disable-next-line
// function isPreSelectedSession(session: any): session is PreSelectedSession {
//     return "preSelectedLevels" in session;
// }

// export function useLevelManager(
//     courseId: string,
//     isCourseCompulsory: boolean,
//     sessionId: string,
//     isSessionCompulsory: boolean,
// ) {
//     const { form } = useInviteFormContext();
//     const { getValues, setValue } = form;

//     // Get the session object and its path
//     const getSession = () => {
//         const batch = getValues("batches");

//         // Get courses array based on type
//         const courses = isCourseCompulsory ? batch.preSelectedCourses : batch.learnerChoiceCourses;
//         // Find course
//         const courseIndex = courses.findIndex((c) => c.id === courseId);
//         if (courseIndex === -1) return { session: null, path: null };

//         const course = courses[courseIndex];

//         // Get base path for the course
//         const coursePath = isCourseCompulsory
//             ? `batches.preSelectedCourses.${courseIndex}`
//             : `batches.learnerChoiceCourses.${courseIndex}`;

//         // Find session based on type
//         let session;
//         let sessionPath;

//         if (isSessionCompulsory && isPreSelectedCourse(course)) {
//             const sessionIndex = course.preSelectedSessions.findIndex((s) => s.id === sessionId);
//             if (sessionIndex === -1) return { session: null, path: null };

//             session = course.preSelectedSessions[sessionIndex];
//             sessionPath = `${coursePath}.preSelectedSessions.${sessionIndex}`;
//         } else {
//             const sessionIndex = course?.learnerChoiceSessions?.findIndex(
//                 (s) => s.id === sessionId,
//             );
//             if (sessionIndex === undefined || sessionIndex === -1)
//                 return { session: null, path: null };

//             session = course?.learnerChoiceSessions[sessionIndex];
//             sessionPath = `${coursePath}.learnerChoiceSessions.${sessionIndex}`;
//         }

//         return { session, path: sessionPath };
//     };

//     // Get the length of learnerChoiceLevels
//     const getLearnerChoiceLevelsLength = () => {
//         const { session } = getSession();
//         if (!session) return 0;

//         return session.learnerChoiceLevels?.length || 0;
//     };

//     // Add a new level with explicit level type control
//     const addLevel = (
//         levelId: string,
//         name: string,
//         packageSessionId: string,
//         isPreSelectedLevel: boolean = false,
//     ) => {
//         const { session, path } = getSession();
//         if (!session || !path) return false;

//         const newLevel: LevelField = {
//             id: levelId,
//             name: name,
//             packageSessionId: packageSessionId,
//         };

//         // Use type assertion for session type
//         if (isPreSelectedLevel && isPreSelectedSession(session)) {
//             // Add to preSelectedLevels
//             const currentLevels = [...(session.preSelectedLevels || [])];
//             currentLevels.push(newLevel);

//             // Use as any to bypass strict typing
//             // eslint-disable-next-line
//             setValue(`${path}.preSelectedLevels` as any, currentLevels);
//         } else {
//             // Add to learnerChoiceLevels
//             const currentLevels = [...(session.learnerChoiceLevels || [])];
//             currentLevels.push(newLevel);

//             // Use as any to bypass strict typing
//             // eslint-disable-next-line
//             setValue(`${path}.learnerChoiceLevels` as any, currentLevels);
//         }

//         return true;
//     };

//     // Delete a level with explicit level type control
//     const deleteLevel = (levelId: string, fromPreSelectedLevels: boolean = false) => {
//         const { session, path } = getSession();
//         if (!session || !path) return false;

//         if (fromPreSelectedLevels && isPreSelectedSession(session)) {
//             // Delete from preSelectedLevels
//             if (!session.preSelectedLevels) return false;

//             const currentLevels = [...session.preSelectedLevels];
//             const updatedLevels = currentLevels.filter((level) => level.id !== levelId);

//             // Use as any to bypass strict typing
//             // eslint-disable-next-line
//             setValue(`${path}.preSelectedLevels` as any, updatedLevels);
//         } else {
//             // Delete from learnerChoiceLevels
//             if (!session.learnerChoiceLevels) return false;

//             const currentLevels = [...session.learnerChoiceLevels];
//             const updatedLevels = currentLevels.filter((level) => level.id !== levelId);

//             // Use as any to bypass strict typing
//             // eslint-disable-next-line
//             setValue(`${path}.learnerChoiceLevels` as any, updatedLevels);
//         }

//         return true;
//     };

//     // Change level selection mode
//     const changeLevelSelectionMode = (newMode: SelectionMode) => {
//         const { path } = getSession();
//         if (!path) return false;

//         // Use as any to bypass strict typing
//         // eslint-disable-next-line
//         setValue(`${path}.levelSelectionMode` as any, newMode);
//         return true;
//     };

//     const setMaxLevels = (newMaxLevels: number) => {
//         const { path } = getSession();
//         if (!path) return false;

//         // Use as any to bypass strict typing
//         // eslint-disable-next-line
//         setValue(`${path}.maxLevels` as any, newMaxLevels);
//         return true;
//     };

//     return {
//         getSession,
//         getLearnerChoiceLevelsLength,
//         addLevel,
//         deleteLevel,
//         changeLevelSelectionMode,
//         setMaxLevels,
//     };
// }
