// import { useState, useEffect } from "react";
// import { BatchSelectionMode } from "../BatchSelectionMode";
// import {
//     LearnerChoiceSession,
//     PreSelectedSession,
//     SelectionMode,
// } from "@/routes/students/invite/-schema/InviteFormSchema";
// import SelectField from "@/components/design-system/select-field";
// import { useSessionManager } from "../../../../-hooks/useSessionManager";
// import { useLevelManager } from "../../../../-hooks/useLevelManager";
// import { useInviteFormContext } from "@/routes/students/invite/-context/useInviteFormContext";
// import { MyButton } from "@/components/design-system/button";
// import { PencilSimple } from "phosphor-react";
// import { LevelSelection } from "../level/LevelSelection";

// interface SessionSelectionProps {
//     courseId: string;
//     isCourseCompulsory: boolean;
//     sessionId?: string;
//     isSessionCompulsory?: boolean;
//     handleIsAddingSession?: (value: boolean) => void;
//     handleIsLevelSaved: (value: boolean) => void;
// }

// // Type guard for PreSelectedSession
// // eslint-disable-next-line
// function isPreSelectedSession(session: any): session is PreSelectedSession {
//     return "preSelectedLevels" in session;
// }

// export const SessionSelection = ({
//     courseId,
//     isCourseCompulsory,
//     sessionId,
//     isSessionCompulsory,
//     handleIsAddingSession,
//     handleIsLevelSaved,
// }: SessionSelectionProps) => {
//     const { form } = useInviteFormContext();
//     const [selectionMode, setSelectionMode] = useState<SelectionMode>(
//         isSessionCompulsory !== undefined
//             ? isSessionCompulsory
//                 ? "institute"
//                 : "student"
//             : isCourseCompulsory
//               ? "institute"
//               : "student",
//     );

//     const [selectedSessionId, setSelectedSessionId] = useState<string>(sessionId || "");
//     const [initialSessionId, setInitialSessionId] = useState<string>(sessionId || "");
//     const [isEditing, setIsEditing] = useState<boolean>(!sessionId); // Start in editing mode if no sessionId provided
//     const [savedSession, setSavedSession] = useState<{ id: string; name: string } | null>(null);
//     const [isLevelAdding, setIsLevelAdding] = useState(false);

//     const handleIsLevelAdding = (value: boolean) => setIsLevelAdding(value);

//     const { getAllAvailableSessions, addOrUpdateSession } = useSessionManager(
//         courseId,
//         isCourseCompulsory,
//     );

//     // Use the getSession utility from useLevelManager
//     const levelManager = useLevelManager(
//         courseId,
//         isCourseCompulsory,
//         selectedSessionId,
//         selectionMode === "institute",
//     );

//     const { getSession } = levelManager;

//     const [sessionOptions, setSessionOptions] = useState<
//         Array<{ _id: string; value: string; label: string }>
//     >([]);

//     // Prepare session options and check for existing session
//     useEffect(() => {
//         if (sessionId) {
//             // If sessionId is provided, get the session details
//             const { session } = getSession();

//             // If session exists, set it as saved
//             if (session) {
//                 setSavedSession({
//                     id: session.id,
//                     name: session.name,
//                 });
//                 setSelectedSessionId(session.id);
//                 setInitialSessionId(session.id);
//                 setIsEditing(false); // Not in editing mode if we have a session
//             }

//             // Get available sessions
//             const availableSessions = getAllAvailableSessions();

//             // Initialize with empty array (explicitly typed)
//             const options: Array<{ _id: string; value: string; label: string }> = [];

//             // Add current session as first option if it exists
//             if (session) {
//                 options.push({
//                     _id: session.id,
//                     value: session.id,
//                     label: session.name,
//                 });
//             }
//             // Add other available sessions
//             availableSessions.forEach((s) => {
//                 // Avoid duplicates
//                 if (!options.some((option) => option.value === s.id)) {
//                     options.push({
//                         _id: s.id,
//                         value: s.id,
//                         label: s.name,
//                     });
//                 }
//             });

//             setSessionOptions(options);
//         } else {
//             // If no sessionId, just use all available sessions
//             const availableSessions = getAllAvailableSessions();
//             const options = availableSessions.map((session) => ({
//                 _id: session.id,
//                 value: session.id,
//                 label: session.name,
//             }));

//             setSessionOptions(options);

//             // Set first option as selected if available
//             if (options.length > 0 && options[0]) {
//                 setSelectedSessionId(options[0].value);
//                 setInitialSessionId(options[0].value);
//             }
//         }
//     }, [courseId, sessionId]);

//     const handleSelectionModeChange = (mode: SelectionMode) => {
//         setSelectionMode(mode);
//     };

//     const handleSessionSelect = (value: string) => {
//         setSelectedSessionId(value);
//     };

//     useEffect(() => {
//         if (!isEditing && !isLevelAdding) handleIsAddingSession && handleIsAddingSession(false);
//         else handleIsAddingSession && handleIsAddingSession(true);
//     }, [isEditing, isLevelAdding]);

//     const handleSaveSession = () => {
//         // Find the session name from options
//         const selectedSession = sessionOptions.find((option) => option.value === selectedSessionId);

//         if (!selectedSession) {
//             console.error("Selected session not found in options");
//             return;
//         }

//         // Create a new session object based on selection mode
//         if (selectionMode === "institute") {
//             const newSession: Partial<PreSelectedSession> = {
//                 id: selectedSessionId,
//                 name: selectedSession.label,
//                 maxLevels: 0,
//                 levelSelectionMode: "institute",
//                 learnerChoiceLevels: [],
//                 preSelectedLevels: [],
//             };

//             // Add or update session with the replace ID if editing
//             const success = addOrUpdateSession(newSession, selectionMode, sessionId);

//             if (success) {
//                 console.log("Successfully saved institute session:", selectedSessionId);
//                 // Update the initial session ID to match the current selection
//                 setInitialSessionId(selectedSessionId);

//                 // Save the session info for display
//                 setSavedSession({
//                     id: selectedSessionId,
//                     name: selectedSession.label,
//                 });

//                 // Exit editing mode
//                 setIsEditing(false);
//             } else {
//                 console.error("Failed to save institute session");
//             }
//         } else {
//             // For student selection mode
//             const newSession: Partial<LearnerChoiceSession> = {
//                 id: selectedSessionId,
//                 name: selectedSession.label,
//                 maxLevels: 0,
//                 levelSelectionMode: "student",
//                 learnerChoiceLevels: [],
//             };

//             // Add or update session with the replace ID if editing
//             const success = addOrUpdateSession(newSession, selectionMode, sessionId);

//             if (success) {
//                 // Update the initial session ID to match the current selection
//                 setInitialSessionId(selectedSessionId);

//                 // Save the session info for display
//                 setSavedSession({
//                     id: selectedSessionId,
//                     name: selectedSession.label,
//                 });

//                 // Exit editing mode
//                 setIsEditing(false);
//             } else {
//                 console.error("Failed to save learner choice session");
//             }
//         }
//     };

//     const handleEditClick = () => {
//         setIsEditing(true);
//     };

//     // Determine select field label based on selection mode
//     const selectFieldLabel = selectionMode === "institute" ? "Compulsory" : "Learner Choice";

//     // Determine if we should show the save button (only when selected differs from initial)
//     const showSaveButton = selectedSessionId !== initialSessionId || isEditing;

//     // Get the session details
//     const { session: sessionDetails } = getSession();

//     // Render the LevelSelection component with proper type handling
//     const renderLevelSelection = () => {
//         if (!sessionDetails || isEditing || !savedSession) return null;

//         // Common props for both session types
//         const commonProps = {
//             courseId,
//             isCourseCompulsory,
//             sessionId: selectedSessionId,
//             isSessionCompulsory: selectionMode === "institute",
//             levelSelectionMode: sessionDetails.levelSelectionMode,
//             maxLevels: sessionDetails.maxLevels,
//             learnerChoiceLevels: sessionDetails.learnerChoiceLevels || [],
//         };

//         // Add preSelectedLevels only if the session is a PreSelectedSession
//         if (isPreSelectedSession(sessionDetails)) {
//             return (
//                 <LevelSelection
//                     {...commonProps}
//                     preSelectedLevels={sessionDetails.preSelectedLevels}
//                     handleIsLevelAdding={handleIsLevelAdding}
//                     handleIsLevelSaved={handleIsLevelSaved}
//                 />
//             );
//         } else {
//             return (
//                 <LevelSelection
//                     {...commonProps}
//                     preSelectedLevels={[]}
//                     handleIsLevelAdding={handleIsLevelAdding}
//                     handleIsLevelSaved={handleIsLevelSaved}
//                 />
//             );
//         }
//     };

//     return (
//         <div className="flex w-full flex-col gap-1 rounded-lg border border-neutral-300 bg-neutral-50 py-2 pl-2">
//             {isEditing ? (
//                 sessionOptions.length > 0 && (
//                     <>
//                         <BatchSelectionMode
//                             title="Session"
//                             parentSelectionMode={isCourseCompulsory ? "institute" : "student"}
//                             mode={selectionMode}
//                             onChangeMode={handleSelectionModeChange}
//                         />

//                         <div className="flex items-center gap-3">
//                             <SelectField
//                                 label={`${selectFieldLabel} Session`}
//                                 name="sessionSelect"
//                                 options={sessionOptions}
//                                 control={form.control}
//                                 onSelect={handleSessionSelect}
//                                 required={true}
//                                 className="w-64"
//                                 selectFieldForInvite={true}
//                             />
//                             {showSaveButton && (
//                                 <MyButton
//                                     buttonType="primary"
//                                     scale="small"
//                                     onClick={handleSaveSession}
//                                     disabled={!selectedSessionId}
//                                     type="button"
//                                 >
//                                     Save
//                                 </MyButton>
//                             )}
//                         </div>
//                     </>
//                 )
//             ) : (
//                 // Display mode - show session name with edit button and LevelSelection component
//                 <div className="flex w-full gap-6">
//                     <div className="flex justify-between gap-2 rounded-md">
//                         <div className="flex flex-col">
//                             <p className="text-body">
//                                 {savedSession?.name}
//                                 {` (${selectionMode == "institute" ? "Compulsory" : "Optional"})`}
//                             </p>
//                         </div>
//                         <MyButton
//                             buttonType="secondary"
//                             scale="small"
//                             layoutVariant="icon"
//                             onClick={handleEditClick}
//                             type="button"
//                         >
//                             <PencilSimple />
//                         </MyButton>
//                     </div>

//                     {/* Use the renderLevelSelection function to properly handle types */}
//                     {renderLevelSelection()}
//                 </div>
//             )}
//         </div>
//     );
// };
