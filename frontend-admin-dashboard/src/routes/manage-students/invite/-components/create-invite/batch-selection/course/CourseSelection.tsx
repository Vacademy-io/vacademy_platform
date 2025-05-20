// import { useEffect, useState } from "react";
// import { BatchSelectionMode } from "../BatchSelectionMode";
// import {
//     LearnerChoiceCourse,
//     PreSelectedCourse,
//     SelectionMode,
// } from "@/routes/students/invite/-schema/InviteFormSchema";
// import { useCourseManager } from "../../../../-hooks/useCourseManager";
// import { useSessionManager } from "../../../../-hooks/useSessionManager";
// import SelectField from "@/components/design-system/select-field";
// import { MyButton } from "@/components/design-system/button";
// import { PencilSimple } from "phosphor-react";
// import { SessionList } from "../session/SessionList";
// import { useInviteFormContext } from "@/routes/students/invite/-context/useInviteFormContext";

// interface CourseSelectionProps {
//     courseId?: string;
//     isCourseCompulsory?: boolean;
//     handleIsAddingCourse: (value: boolean) => void;
// }

// export const CourseSelection = ({
//     courseId,
//     isCourseCompulsory,
//     handleIsAddingCourse,
// }: CourseSelectionProps) => {
//     const { form } = useInviteFormContext();
//     const [selectionMode, setSelectionMode] = useState<SelectionMode>(
//         !isCourseCompulsory ? "student" : "institute",
//     );
//     const [isEditing, setIsEditing] = useState<boolean>(!courseId);
//     const [courseOptions, setCourseOptions] = useState<
//         Array<{ _id: string; value: string; label: string }>
//     >([]);
//     const { getAllAvailableCourses, addOrUpdateCourse } = useCourseManager();
//     const [selectedCourseId, setSelectedCourseId] = useState<string>(courseId || "");
//     const [inititalCourseId, setInititalCourseId] = useState<string>(courseId || "");
//     const { getCourse } = useSessionManager(
//         courseId || "",
//         isCourseCompulsory !== undefined ? isCourseCompulsory : true,
//     );
//     const [savedCourse, setSavedCourse] = useState<{ id: string; name: string } | null>(
//         getCourse().course,
//     );
//     const [isAddingSession, setIsAddingSession] = useState(true);
//     const handleIsAddingSession = (value: boolean) => setIsAddingSession(value);
//     const [sessionSaved, setSessionSaved] = useState(false);
//     const handleSessionSaved = (value: boolean) => setSessionSaved(value);

//     useEffect(() => {
//         console.log("courseId: ", courseId);
//         console.log("saved course: ", savedCourse);
//     }, []);

//     useEffect(() => {
//         setSavedCourse(getCourse().course);
//         console.log(getCourse());
//     }, [courseId]);

//     useEffect(() => {
//         if (!isAddingSession && !isEditing && sessionSaved) handleIsAddingCourse(false);
//         else handleIsAddingCourse(true);
//     }, [isAddingSession, isEditing, sessionSaved]);

//     useEffect(() => {
//         if (courseId && isCourseCompulsory) {
//             // If sessionId is provided, get the session details
//             const { course } = getCourse();

//             // If session exists, set it as saved
//             if (course) {
//                 setSavedCourse({
//                     id: course.id,
//                     name: course.name,
//                 });
//                 setSelectedCourseId(course.id);
//                 setInititalCourseId(course.id);
//                 setIsEditing(false); // Not in editing mode if we have a session
//             }

//             // Get available sessions
//             const availableCourses = getAllAvailableCourses();

//             // Initialize with empty array (explicitly typed)
//             const options: Array<{ _id: string; value: string; label: string }> = [];

//             // Add current session as first option if it exists
//             if (course) {
//                 options.push({
//                     _id: course.id,
//                     value: course.id,
//                     label: course.name,
//                 });
//             }

//             // Add other available sessions
//             availableCourses.forEach((c) => {
//                 // Avoid duplicates
//                 if (!options.some((option) => option.value === c.id)) {
//                     options.push({
//                         _id: c.id,
//                         value: c.id,
//                         label: c.name,
//                     });
//                 }
//             });

//             setCourseOptions(options);
//         } else {
//             // If no sessionId, just use all available sessions
//             const availableSessions = getAllAvailableCourses();
//             const options = availableSessions.map((course) => ({
//                 _id: course.id,
//                 value: course.id,
//                 label: course.name,
//             }));

//             setCourseOptions(options);

//             // Set first option as selected if available
//             if (options.length > 0 && options[0]) {
//                 setSelectedCourseId(options[0].value);
//                 setInititalCourseId(options[0].value);
//             }
//         }
//     }, [courseId]);

//     const handleSelectionMode = (mode: SelectionMode) => setSelectionMode(mode);

//     // Determine select field label based on selection mode
//     const selectFieldLabel = selectionMode === "institute" ? "Compulsory" : "Learner Choice";

//     // Determine if we should show the save button (only when selected differs from initial)
//     const showSaveButton = selectedCourseId !== inititalCourseId || isEditing;

//     // Get the session details
//     const renderSessionList = () => {
//         const { course: courseDetails } = getCourse();
//         return (
//             <SessionList
//                 courseId={selectedCourseId}
//                 isCourseCompulsory={selectionMode == "institute" ? true : false}
//                 maxSessions={courseDetails?.maxSessions}
//                 handleIsAddingSession={handleIsAddingSession}
//                 isAddingSession={isAddingSession}
//                 handleSessionSaved={handleSessionSaved}
//             />
//         );
//     };

//     const handleCourseSelect = (value: string) => {
//         setSelectedCourseId(value);
//     };

//     const handleEditClick = () => {
//         setIsEditing(true);
//     };

//     const handleSaveCourse = () => {
//         const selectedCourse = courseOptions.find((option) => option.value === selectedCourseId);

//         if (!selectedCourse) {
//             console.error("Selected session not found in options");
//             return;
//         }

//         if (selectionMode === "institute") {
//             const newCourse: Partial<PreSelectedCourse> = {
//                 id: selectedCourseId,
//                 name: selectedCourse.label,
//                 maxSessions: 0,
//                 sessionSelectionMode: "institute",
//                 learnerChoiceSessions: [],
//                 preSelectedSessions: [],
//             };

//             // Add or update session with the replace ID if editing
//             const success = addOrUpdateCourse(newCourse, selectionMode, courseId);

//             if (success) {
//                 console.log("Successfully saved institute course:", selectedCourse);
//                 // Update the initial session ID to match the current selection
//                 setInititalCourseId(selectedCourseId);

//                 // Save the session info for display
//                 setSavedCourse({
//                     id: selectedCourseId,
//                     name: selectedCourse.label,
//                 });

//                 // Exit editing mode
//                 setIsEditing(false);
//             } else {
//                 console.error("Failed to save institute session");
//             }
//         } else {
//             // For student selection mode
//             const newCourse: Partial<LearnerChoiceCourse> = {
//                 id: selectedCourseId,
//                 name: selectedCourse.label,
//                 maxSessions: 0,
//                 sessionSelectionMode: "student",
//                 learnerChoiceSessions: [],
//             };

//             // Add or update session with the replace ID if editing
//             const success = addOrUpdateCourse(newCourse, selectionMode, courseId);

//             if (success) {
//                 // Update the initial session ID to match the current selection
//                 setInititalCourseId(selectedCourseId);

//                 // Save the session info for display
//                 setSavedCourse({
//                     id: selectedCourseId,
//                     name: selectedCourse.label,
//                 });

//                 // Exit editing mode
//                 setIsEditing(false);
//             } else {
//                 console.error("Failed to save learner choice course");
//             }
//         }
//     };

//     return (
//         <div className="w-full rounded-lg border border-neutral-300 p-3 py-5">
//             {isEditing ? (
//                 courseOptions.length > 0 && (
//                     <div className="flex flex-col gap-1">
//                         <BatchSelectionMode
//                             title="Course"
//                             mode={selectionMode}
//                             onChangeMode={handleSelectionMode}
//                             parentSelectionMode="institute"
//                         />
//                         <div className="flex items-center gap-3">
//                             <SelectField
//                                 label={`${selectFieldLabel} Course`}
//                                 name="courseSelect"
//                                 options={courseOptions}
//                                 control={form.control}
//                                 onSelect={handleCourseSelect}
//                                 required={true}
//                                 selectFieldForInvite={true}
//                             />
//                             {showSaveButton && (
//                                 <MyButton
//                                     buttonType="primary"
//                                     scale="small"
//                                     onClick={handleSaveCourse}
//                                     disabled={!selectedCourseId}
//                                     type="button"
//                                 >
//                                     Save Course
//                                 </MyButton>
//                             )}
//                         </div>
//                     </div>
//                 )
//             ) : (
//                 <div className="flex flex-col gap-2">
//                     <div className="flex w-fit items-center justify-between gap-2 rounded-md">
//                         <div className="flex items-center gap-3">
//                             <p className="text-subtitle font-semibold underline">Course</p>
//                             <p className="text-body">
//                                 {savedCourse?.name}
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
//                     {renderSessionList()}
//                 </div>
//             )}
//         </div>
//     );
// };
