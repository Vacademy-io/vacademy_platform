// import { MyButton } from "@/components/design-system/button";
// import { useInviteFormContext } from "@/routes/students/invite/-context/useInviteFormContext";
// import { useEffect, useState } from "react";
// import { useCourseManager } from "../../../../-hooks/useCourseManager";
// import { CourseSelection } from "./CourseSelection";
// import { MaxLimitField } from "../MaxLimitField";
// import { TrashSimple } from "phosphor-react";

// export const CourseList = () => {
//     const { form } = useInviteFormContext();
//     const { getValues, watch } = form;
//     const {
//         getAllAvailableCourses,
//         setMaxCourses,
//         hasValidPreSelectedCourseStructure,
//         hasValidLearnerChoiceCourseStructure,
//         isValidPreSelectedCourse,
//         isValidLearnerChoiceCourse,
//         deleteCourse, // Import the deleteCourse function from useCourseManager
//     } = useCourseManager();
//     const [isAddingCourse, setIsAddingCourse] = useState(false);
//     const [isMaxLimitSaved, setIsMaxLimitSaved] = useState(false);
//     useEffect(() => {
//         console.log(isMaxLimitSaved);
//     }, []);
//     const handleIsMaxLimitSaved = (value: boolean) => setIsMaxLimitSaved(value);
//     const handleIsAddingCourse = (value: boolean) => {
//         setIsAddingCourse(value);
//         if (!value) setIsAddingNewCourse(false); // Reset when not adding a course
//     };
//     const [batchData, setBatchData] = useState(getValues("batches"));
//     const [isAddingNewCourse, setIsAddingNewCourse] = useState(false);

//     useEffect(() => {
//         const currentBatchData = getValues("batches");
//         setBatchData(currentBatchData);
//     }, [watch("batches")]);

//     // Default to 0 if maxSessions not provided in props and not on course
//     const currentMaxCourses = batchData?.maxCourses || 1;

//     // Handle max sessions change
//     const handleMaxCoursesChange = (value: number) => {
//         const success = setMaxCourses(value);
//         if (success) {
//             console.log("Max courses updated to:", value);
//         }
//     };

//     // Handle save all button click
//     // const handleSaveAll = () => {
//     //     setIsAddingCourse(false);
//     // };

//     // Handle course deletion
//     const handleDeleteCourse = (courseId: string) => {
//         const success = deleteCourse(courseId);
//         if (success) {
//             console.log("Course deleted successfully:", courseId);
//             // The form state will be updated automatically through the form context
//             // and the component will re-render with the updated batchData
//         } else {
//             console.error("Failed to delete course:", courseId);
//         }
//     };

//     useEffect(() => {
//         if (isAddingCourse == false) setIsAddingCourse(false);
//     }, [isAddingCourse]);

//     const currentAvailableCourses = getAllAvailableCourses();

//     return (
//         <div className="flex flex-col gap-2">
//             <div className="flex flex-col gap-3">
//                 <div className="flex items-center gap-2">
//                     <p className="text-title font-semibold">Batches</p>

//                     {/* Show Save All button when not adding a course */}
//                     {/* {!isAddingCourse &&
//                         (batchData.preSelectedCourses.length > 0 ||
//                             batchData.learnerChoiceCourses.length > 0) && (
//                             <MyButton
//                                 onClick={handleSaveAll}
//                                 type="button"
//                                 scale="small"
//                                 className="w-fit"
//                             >
//                                 Save All
//                             </MyButton>
//                         )} */}

//                     {/* MaxLimitField will handle its own editing/saving state */}
//                     {(batchData.preSelectedCourses.length > 0 ||
//                         batchData.learnerChoiceCourses.length > 0) && (
//                         <MaxLimitField
//                             title="Course"
//                             maxAllowed={batchData.learnerChoiceCourses.length}
//                             maxValue={currentMaxCourses}
//                             onMaxChange={handleMaxCoursesChange}
//                             handleIsMaxLimitSaved={handleIsMaxLimitSaved}
//                         />
//                     )}
//                 </div>

//                 {/* Show a message if no courses are present */}
//                 {batchData.preSelectedCourses.length === 0 &&
//                     batchData.learnerChoiceCourses.length === 0 &&
//                     !isAddingCourse && (
//                         <p className="text-body text-neutral-500">No courses added yet</p>
//                     )}

//                 {hasValidPreSelectedCourseStructure() &&
//                     batchData.preSelectedCourses.length > 0 &&
//                     batchData.preSelectedCourses.map(
//                         (course, key) =>
//                             isValidPreSelectedCourse(course) && (
//                                 <div
//                                     key={key}
//                                     className="flex justify-between rounded-lg border border-neutral-300 bg-primary-50 p-4"
//                                 >
//                                     <div>
//                                         <p>Pre selected Course name: {course.name}</p>
//                                         {course.preSelectedSessions.length > 0 && (
//                                             <p>Pre selection sessions</p>
//                                         )}
//                                         {course.preSelectedSessions.map((session, key1) => (
//                                             <div key={key1}>
//                                                 <p>Session name: {session.name}</p>
//                                                 {session.preSelectedLevels &&
//                                                     session.preSelectedLevels.length > 0 && (
//                                                         <p>Pre selected levels</p>
//                                                     )}
//                                                 {session.preSelectedLevels.map((level, key2) => (
//                                                     <p key={key2}>level name: {level.name}</p>
//                                                 ))}
//                                                 {session.learnerChoiceLevels &&
//                                                     session.learnerChoiceLevels.length > 0 && (
//                                                         <p>learner choice levels</p>
//                                                     )}
//                                                 {session.learnerChoiceLevels.map((level, key2) => (
//                                                     <p key={key2}>level name: {level.name}</p>
//                                                 ))}
//                                             </div>
//                                         ))}
//                                         {course.learnerChoiceSessions.length > 0 && (
//                                             <p>Learner choice sessions</p>
//                                         )}
//                                         {course.learnerChoiceSessions.map((session, key1) => (
//                                             <div key={key1}>
//                                                 <p>Session name: {session.name}</p>
//                                                 {session.learnerChoiceLevels &&
//                                                     session.learnerChoiceLevels.length > 0 && (
//                                                         <p>learner choice levels</p>
//                                                     )}
//                                                 {session.learnerChoiceLevels.map((level, key2) => (
//                                                     <p key={key2}>level name: {level.name}</p>
//                                                 ))}
//                                             </div>
//                                         ))}
//                                     </div>
//                                     <MyButton
//                                         buttonType="secondary"
//                                         scale="small"
//                                         onClick={() => handleDeleteCourse(course.id)}
//                                         type="button"
//                                     >
//                                         <TrashSimple className="text-danger-600" />
//                                     </MyButton>
//                                 </div>
//                             ),
//                     )}

//                 {hasValidLearnerChoiceCourseStructure() &&
//                     batchData.learnerChoiceCourses.length > 0 &&
//                     batchData.learnerChoiceCourses.map(
//                         (course, key) =>
//                             isValidLearnerChoiceCourse(course) && (
//                                 <div
//                                     key={key}
//                                     className="flex justify-between rounded-lg border border-neutral-300 bg-primary-50 p-4"
//                                 >
//                                     <div>
//                                         <p>Learner choice Course name: {course.name}</p>
//                                         {course.learnerChoiceSessions.length > 0 && (
//                                             <p>Learner choice sessions</p>
//                                         )}
//                                         {course.learnerChoiceSessions.map((session, key1) => (
//                                             <div key={key1}>
//                                                 <p>Session name: {session.name}</p>
//                                                 {session.learnerChoiceLevels &&
//                                                     session.learnerChoiceLevels.length > 0 && (
//                                                         <p>learner choice levels</p>
//                                                     )}
//                                                 {session.learnerChoiceLevels.map((level, key2) => (
//                                                     <p key={key2}>level name: {level.name}</p>
//                                                 ))}
//                                             </div>
//                                         ))}
//                                     </div>
//                                     <MyButton
//                                         buttonType="secondary"
//                                         scale="small"
//                                         onClick={() => handleDeleteCourse(course.id)}
//                                         type="button"
//                                     >
//                                         <TrashSimple className="text-danger-600" />
//                                     </MyButton>
//                                 </div>
//                             ),
//                     )}
//             </div>

//             {/* Session Selection form when adding a session */}
//             {isAddingCourse && isAddingNewCourse && (
//                 <div className="flex items-center gap-1">
//                     <CourseSelection handleIsAddingCourse={handleIsAddingCourse} />
//                 </div>
//             )}

//             {!isAddingCourse && currentAvailableCourses.length > 0 && (
//                 <div>
//                     <div
//                         onClick={() => {
//                             setIsAddingCourse(true);
//                             setIsAddingNewCourse(true);
//                         }}
//                         className="w-fit cursor-pointer text-body text-primary-500"
//                     >
//                         Add Course
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// };
