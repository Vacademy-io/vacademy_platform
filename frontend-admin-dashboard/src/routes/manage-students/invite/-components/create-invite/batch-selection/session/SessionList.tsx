// import { useSessionManager } from "../../../../-hooks/useSessionManager";
// import {
//     LearnerChoiceSession,
//     PreSelectedCourse,
//     PreSelectedSession,
// } from "@/routes/students/invite/-schema/InviteFormSchema";
// import { SessionSelection } from "./SessionSelection";
// import { MyButton } from "@/components/design-system/button";
// import { useEffect, useState } from "react";
// import { MaxLimitField } from "../MaxLimitField";

// interface SessionListProps {
//     courseId: string;
//     isCourseCompulsory: boolean;
//     maxSessions?: number;
//     handleIsAddingSession: (value: boolean) => void;
//     isAddingSession: boolean;
//     handleSessionSaved: (value: boolean) => void;
// }

// // Type guard
// // eslint-disable-next-line
// function isPreSelectedCourse(course: any): course is PreSelectedCourse {
//     return "preSelectedSessions" in course;
// }

// export const SessionList = ({
//     courseId,
//     isCourseCompulsory,
//     maxSessions,
//     handleIsAddingSession,
//     isAddingSession,
//     handleSessionSaved,
// }: SessionListProps) => {
//     const { getCourse, getAllAvailableSessions, setMaxSessions, getCurrentSessions } =
//         useSessionManager(courseId, isCourseCompulsory);
//     const { course } = getCourse();
//     const [isMaxLimitSaved, setIsMaxLimitSaved] = useState(false);
//     const handleIsMaxLimitSaved = (value: boolean) => setIsMaxLimitSaved(value);
//     const availableSessions = getAllAvailableSessions();
//     const [sessionsSaved, setSessionsSaved] = useState(false);

//     const [sessions, setSessions] = useState<{
//         preSelectedSessions: PreSelectedSession[];
//         learnerChoiceSessions: LearnerChoiceSession[];
//     }>({
//         preSelectedSessions: [],
//         learnerChoiceSessions: course?.learnerChoiceSessions || [],
//     });
//     const currentMaxSessions = maxSessions || course?.maxSessions || 1;
//     const [isLevelSaved, setIsLevelSaved] = useState(false);
//     const handleIsLevelSaved = (value: boolean) => setIsLevelSaved(value);

//     useEffect(() => {
//         if (!isLevelSaved) handleIsAddingSession(true);
//     }, [isLevelSaved]);

//     useEffect(() => {
//         const value = getCurrentSessions();
//         setSessions(value);
//     }, [courseId, isCourseCompulsory, isAddingSession]);

//     // Handle max sessions change
//     const handleMaxSessionsChange = (value: number) => {
//         const success = setMaxSessions(value);
//         if (success) {
//             console.log("Max sessions updated to:", value);
//         }
//     };

//     // Handle save all button click
//     const handleSaveAll = () => {
//         setSessionsSaved(true);
//     };

//     useEffect(() => {
//         handleSessionSaved(sessionsSaved);
//         handleIsAddingSession(!sessionsSaved);
//     }, [sessionsSaved]);

//     return (
//         <div className="flex flex-col">
//             <div className="flex items-center justify-between gap-2">
//                 <p className="text-subtitle font-semibold underline">Sessions</p>

//                 {/* Show Save All button when not adding a session */}
//                 {!isAddingSession &&
//                     (sessions.preSelectedSessions.length > 0 ||
//                         sessions.learnerChoiceSessions.length > 0) &&
//                     !isMaxLimitSaved &&
//                     !sessionsSaved &&
//                     (sessions.learnerChoiceSessions.length > 0 ||
//                         sessions.preSelectedSessions.length > 0) &&
//                     isLevelSaved && (
//                         <MyButton onClick={handleSaveAll} type="button" scale="small">
//                             Save All
//                         </MyButton>
//                     )}

//                 {/* MaxLimitField will handle its own editing/saving state */}
//                 {!isAddingSession && sessions.learnerChoiceSessions.length > 0 && sessionsSaved && (
//                     <MaxLimitField
//                         title="Session"
//                         maxAllowed={sessions.learnerChoiceSessions.length}
//                         maxValue={currentMaxSessions}
//                         onMaxChange={handleMaxSessionsChange}
//                         handleIsMaxLimitSaved={handleIsMaxLimitSaved}
//                     />
//                 )}
//             </div>

//             {sessions.preSelectedSessions.length === 0 &&
//                 sessions.learnerChoiceSessions.length === 0 &&
//                 !isAddingSession && (
//                     <p className="text-body text-neutral-500">No sessions added yet</p>
//                 )}

//             {sessions.preSelectedSessions.length > 0 &&
//                 sessions.preSelectedSessions.map((preSelectedSession, index) => (
//                     <SessionSelection
//                         key={index}
//                         courseId={courseId}
//                         isCourseCompulsory={isCourseCompulsory}
//                         handleIsAddingSession={handleIsAddingSession}
//                         sessionId={preSelectedSession.id}
//                         isSessionCompulsory={true}
//                         handleIsLevelSaved={handleIsLevelSaved}
//                     />
//                 ))}
//             {sessions.learnerChoiceSessions.length > 0 &&
//                 sessions.learnerChoiceSessions.map((learnerChoiceSession, index) => (
//                     <SessionSelection
//                         key={index}
//                         courseId={courseId}
//                         isCourseCompulsory={isCourseCompulsory}
//                         handleIsAddingSession={handleIsAddingSession}
//                         sessionId={learnerChoiceSession.id}
//                         isSessionCompulsory={false}
//                         handleIsLevelSaved={handleIsLevelSaved}
//                     />
//                 ))}

//             {/* Add Session button or Session form */}
//             {availableSessions.length > 0 && !isAddingSession && (
//                 <MyButton
//                     onClick={() => handleIsAddingSession(true)}
//                     type="button"
//                     scale="small"
//                     buttonType="text"
//                     className="w-fit px-0 text-primary-500"
//                 >
//                     Add session
//                 </MyButton>
//             )}

//             {/* Session Selection form when adding a session */}
//             {isAddingSession && (
//                 <div className="flex items-center gap-1">
//                     <SessionSelection
//                         courseId={courseId}
//                         isCourseCompulsory={isCourseCompulsory}
//                         handleIsAddingSession={handleIsAddingSession}
//                         handleIsLevelSaved={handleIsLevelSaved}
//                     />
//                 </div>
//             )}
//         </div>
//     );
// };
