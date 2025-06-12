// import { LevelField, SelectionMode } from "@/routes/students/invite/-schema/InviteFormSchema";
// import { useLevelManager } from "../../../../-hooks/useLevelManager";
// import { BatchSelectionMode } from "../BatchSelectionMode";
// import { useEffect, useState } from "react";
// import { useInstituteDetailsStore } from "@/stores/students/students-list/useInstituteDetailsStore";
// import { MaxLimitField } from "../MaxLimitField";
// import { MyButton } from "@/components/design-system/button";
// import { PencilSimple } from "phosphor-react";
// import MultiSelectDropdown from "../MultiSelectDropdown";

// interface LevelSelectionProps {
//     courseId: string;
//     isCourseCompulsory: boolean;
//     sessionId: string;
//     isSessionCompulsory: boolean;
//     levelSelectionMode: SelectionMode;
//     preSelectedLevels: LevelField[];
//     learnerChoiceLevels: LevelField[];
//     maxLevels: number;
//     handleIsLevelAdding: (value: boolean) => void;
//     handleIsLevelSaved: (value: boolean) => void;
// }

// export const LevelSelection = ({
//     courseId,
//     isCourseCompulsory,
//     sessionId,
//     isSessionCompulsory,
//     levelSelectionMode,
//     preSelectedLevels,
//     learnerChoiceLevels,
//     maxLevels,
//     // handleIsLevelAdding,
//     handleIsLevelSaved,
// }: LevelSelectionProps) => {
//     const {
//         getLearnerChoiceLevelsLength,
//         addLevel,
//         deleteLevel,
//         changeLevelSelectionMode,
//         setMaxLevels,
//     } = useLevelManager(courseId, isCourseCompulsory, sessionId, isSessionCompulsory);

//     // Local state for UI management
//     const [localSelectionMode, setLocalSelectionMode] = useState<SelectionMode>(levelSelectionMode);
//     const [isSaved, setIsSaved] = useState<boolean>(false);
//     const [isMaxLimitSaved, setIsMaxLimitSaved] = useState(false);
//     const handleIsMaxLimitSaved = (value: boolean) => setIsMaxLimitSaved(value);

//     useEffect(() => {
//         handleIsLevelSaved(isSaved);
//     }, [isSaved]);

//     // Local state for level selections
//     const [compulsorySelected, setCompulsorySelected] = useState<string[]>(
//         preSelectedLevels.map((level) => level.id),
//     );
//     const [learnerChoiceSelected, setLearnerChoiceSelected] = useState<string[]>(
//         learnerChoiceLevels.map((level) => level.id),
//     );

//     const { getLevelsFromPackage, getPackageSessionId } = useInstituteDetailsStore();

//     // Get the raw level list
//     const rawLevelList = getLevelsFromPackage({ courseId, sessionId });

//     // Create options for dropdowns
//     const levelOptions = rawLevelList.map((level) => ({
//         id: level.id,
//         name: level.name,
//     }));

//     // Filter options for each dropdown to prevent duplicate selections
//     const compulsoryOptions = levelOptions.filter(
//         (option) => !learnerChoiceSelected.includes(option.id),
//     );

//     const learnerChoiceOptions = levelOptions.filter(
//         (option) => !compulsorySelected.includes(option.id),
//     );

//     // Handle selection mode changes
//     const handleLocalSelectionModeChange = (mode: SelectionMode) => {
//         setLocalSelectionMode(mode);

//         // Reset selections when mode changes
//         setCompulsorySelected([]);
//         setLearnerChoiceSelected([]);
//     };

//     // Handle save button click
//     const handleSaveLevels = () => {
//         // Update the selection mode
//         changeLevelSelectionMode(localSelectionMode);

//         // Clear existing levels to avoid duplicates
//         preSelectedLevels.forEach((level) => {
//             deleteLevel(level.id, true);
//         });

//         learnerChoiceLevels.forEach((level) => {
//             deleteLevel(level.id, false);
//         });

//         // Add selected compulsory levels
//         compulsorySelected.forEach((id) => {
//             const level = rawLevelList.find((l) => l.id === id);
//             if (level) {
//                 const packageSessionId =
//                     getPackageSessionId({
//                         courseId: courseId,
//                         sessionId: sessionId,
//                         levelId: level.id,
//                     }) || "";

//                 addLevel(level.id, level.name, packageSessionId, true);
//             }
//         });

//         // Add selected learner choice levels
//         learnerChoiceSelected.forEach((id) => {
//             const level = rawLevelList.find((l) => l.id === id);
//             if (level) {
//                 const packageSessionId =
//                     getPackageSessionId({
//                         courseId: courseId,
//                         sessionId: sessionId,
//                         levelId: level.id,
//                     }) || "";

//                 addLevel(level.id, level.name, packageSessionId, false);
//             }
//         });

//         // Prepare data for the saved view
//         const updatedSelectedLevels = [
//             ...compulsorySelected.map((id) => {
//                 const level = rawLevelList.find((l) => l.id === id);
//                 return {
//                     id,
//                     name: level?.name || "",
//                     packageSessionId: "",
//                     type: "compulsory" as const,
//                 };
//             }),
//             ...learnerChoiceSelected.map((id) => {
//                 const level = rawLevelList.find((l) => l.id === id);
//                 return {
//                     id,
//                     name: level?.name || "",
//                     packageSessionId: "",
//                     type: "learnerChoice" as const,
//                 };
//             }),
//         ];

//         setSelectedLevels(updatedSelectedLevels);
//         setIsSaved(true);
//     };

//     // Handle max level change
//     const handleMaxLevelChange = (value: number) => {
//         setMaxLevels(value);
//     };

//     // Handle edit button click
//     const handleEdit = () => {
//         setIsSaved(false);
//         setIsMaxLimitSaved(false);
//     };

//     // Get the current learner choice levels length
//     const learnerChoiceLength = getLearnerChoiceLevelsLength();

//     // State for the saved view
//     const [selectedLevels, setSelectedLevels] = useState([
//         ...preSelectedLevels.map((level) => ({ ...level, type: "compulsory" as const })),
//         ...learnerChoiceLevels.map((level) => ({ ...level, type: "learnerChoice" as const })),
//     ]);

//     // useEffect(() => {
//     //     if (learnerChoiceSelected.length == 0) {
//     //         if (isSaved) handleIsLevelAdding(false);
//     //         else handleIsLevelAdding(true);
//     //     } else {
//     //         if (isMaxLimitSaved && isSaved) handleIsLevelAdding(false);
//     //         else handleIsLevelAdding(true);
//     //     }
//     // }, [learnerChoiceSelected, isMaxLimitSaved, isSaved]);

//     return (
//         <div className="flex flex-col gap-2">
//             <div className="flex items-center gap-3">
//                 <h3 className="text-subtitle font-semibold underline">Levels</h3>
//                 {isSaved ? (
//                     <div className="flex gap-3">
//                         <MyButton
//                             onClick={handleEdit}
//                             buttonType="secondary"
//                             type="button"
//                             layoutVariant="icon"
//                             scale="small"
//                         >
//                             <PencilSimple size={16} />
//                         </MyButton>
//                     </div>
//                 ) : localSelectionMode === "student" ? (
//                     learnerChoiceSelected.length > 0 &&
//                     !isMaxLimitSaved && (
//                         <MyButton
//                             onClick={handleSaveLevels}
//                             className="w-fit"
//                             type="button"
//                             scale="small"
//                         >
//                             Save Levels
//                         </MyButton>
//                     )
//                 ) : localSelectionMode === "institute" ? (
//                     compulsorySelected.length > 0 &&
//                     !isMaxLimitSaved && (
//                         <MyButton
//                             onClick={handleSaveLevels}
//                             className="w-fit"
//                             type="button"
//                             scale="small"
//                         >
//                             Save Levels
//                         </MyButton>
//                     )
//                 ) : (
//                     (compulsorySelected.length > 0 || learnerChoiceSelected.length > 0) &&
//                     !isMaxLimitSaved && (
//                         <MyButton
//                             onClick={handleSaveLevels}
//                             className="w-fit"
//                             type="button"
//                             scale="small"
//                         >
//                             Save Levels
//                         </MyButton>
//                     )
//                 )}
//                 {/* Add MaxLimitField after the level list if learner choice levels exist */}
//                 {isSaved && learnerChoiceSelected.length > 0 && (
//                     <div className="mt-2">
//                         <MaxLimitField
//                             title="Level"
//                             maxAllowed={learnerChoiceLength || 10}
//                             maxValue={maxLevels}
//                             onMaxChange={handleMaxLevelChange}
//                             handleIsMaxLimitSaved={handleIsMaxLimitSaved}
//                         />
//                     </div>
//                 )}
//             </div>
//             {!isSaved ? (
//                 <>
//                     <BatchSelectionMode
//                         title="Level"
//                         parentSelectionMode={isSessionCompulsory ? "institute" : "student"}
//                         bothEnabled={true}
//                         mode={localSelectionMode}
//                         onChangeMode={handleLocalSelectionModeChange}
//                     />

//                     <div className="flex justify-between gap-5">
//                         {/* Compulsory Levels Dropdown */}
//                         {(localSelectionMode === "institute" || localSelectionMode === "both") && (
//                             <MultiSelectDropdown
//                                 label="Compulsory"
//                                 options={compulsoryOptions}
//                                 selectedValues={compulsorySelected}
//                                 onChange={setCompulsorySelected}
//                                 className="w-full"
//                             />
//                         )}

//                         {/* Learner Choice Levels Dropdown */}
//                         {(localSelectionMode === "student" || localSelectionMode === "both") && (
//                             <MultiSelectDropdown
//                                 label="Learner Choice"
//                                 options={learnerChoiceOptions}
//                                 selectedValues={learnerChoiceSelected}
//                                 onChange={setLearnerChoiceSelected}
//                                 className="w-full"
//                             />
//                         )}
//                     </div>
//                 </>
//             ) : (
//                 <div className="flex flex-col gap-2">
//                     {selectedLevels.map((level) => (
//                         <div key={level.id} className={`w-fit text-body text-neutral-600`}>
//                             {level.name}{" "}
//                             {level.type === "compulsory" ? "(Compulsory)" : "(Optional)"}
//                         </div>
//                     ))}

//                     {selectedLevels.length === 0 && (
//                         <p className="text-gray-500">No levels selected</p>
//                     )}
//                 </div>
//             )}
//         </div>
//     );
// };
