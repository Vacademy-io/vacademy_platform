// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// import { SelectionMode } from "../../../-schema/InviteFormSchema";

// interface BatchSelectionModeProps {
//     title: string;
//     parentSelectionMode: SelectionMode;
//     bothEnabled?: boolean;
//     mode: SelectionMode;
//     onChangeMode: (mode: SelectionMode) => void;
// }

// export const BatchSelectionMode = ({
//     title,
//     parentSelectionMode,
//     bothEnabled = false,
//     mode,
//     onChangeMode,
// }: BatchSelectionModeProps) => {
//     return (
//         <div className={`flex flex-col gap-4`}>
//             <div className="flex items-center gap-6">
//                 <p className="text-body font-semibold text-neutral-600">{title} Selection Mode</p>
//                 <RadioGroup
//                     className="flex items-center gap-6"
//                     value={mode}
//                     onValueChange={(value: SelectionMode) => {
//                         onChangeMode(value);
//                     }}
//                     // disabled={isDisabled}
//                 >
//                     <div className="flex items-center gap-2">
//                         <RadioGroupItem
//                             value="institute"
//                             id="institute"
//                             disabled={parentSelectionMode === "student"}
//                         />
//                         <label
//                             htmlFor={`${title}-institute`}
//                             className={parentSelectionMode === "student" ? "text-neutral-400" : ""}
//                         >
//                             Institute assigns
//                         </label>
//                     </div>
//                     <div className="flex items-center gap-2">
//                         <RadioGroupItem value="student" id="student" />
//                         <label htmlFor={`${title}-student`}>Student chooses</label>
//                     </div>
//                     {bothEnabled && (
//                         <div className="flex items-center gap-2">
//                             <RadioGroupItem
//                                 value="both"
//                                 id="both"
//                                 disabled={parentSelectionMode === "student"}
//                             />
//                             <label
//                                 htmlFor={`${title}-both`}
//                                 className={
//                                     parentSelectionMode === "student" ? "text-neutral-400" : ""
//                                 }
//                             >
//                                 Both
//                             </label>
//                         </div>
//                     )}
//                 </RadioGroup>
//             </div>
//         </div>
//     );
// };
