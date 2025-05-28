// import { MyInput } from "@/components/design-system/input";
// import { useEffect, useState } from "react";
// import { MyButton } from "@/components/design-system/button";
// import { Check, PencilSimple } from "phosphor-react";

// interface MaxLimitFieldProp {
//     title: string;
//     maxAllowed: number;
//     maxValue: number;
//     isDisabled?: boolean;
//     onMaxChange?: (value: number) => void;
//     handleIsMaxLimitSaved: (value: boolean) => void;
// }

// export const MaxLimitField = ({
//     title,
//     maxAllowed,
//     maxValue,
//     isDisabled = false,
//     onMaxChange,
//     handleIsMaxLimitSaved,
// }: MaxLimitFieldProp) => {
//     const [input, setInput] = useState(maxValue.toString() || "1");
//     const [isEditing, setIsEditing] = useState(true); // Start in editing mode
//     const [savedValue, setSavedValue] = useState(maxValue);

//     useEffect(() => {
//         handleIsMaxLimitSaved(!isEditing);
//     }, [isEditing]);

//     // Update input when maxValue changes externally
//     useEffect(() => {
//         setInput(maxValue.toString());
//         setSavedValue(maxValue);
//     }, [maxValue]);

//     const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//         const value = parseInt(e.target.value) || 0;
//         let newValue: number;

//         // Ensure the value is between 1 and maxAllowed
//         if (value < 1) {
//             newValue = 1;
//             setInput("1");
//         } else if (value > maxAllowed) {
//             newValue = maxAllowed;
//             setInput(maxAllowed.toString());
//         } else {
//             newValue = value;
//             setInput(value.toString());
//         }

//         // Call the callback if provided
//         if (onMaxChange) {
//             onMaxChange(newValue);
//         }
//     };

//     const handleSave = () => {
//         setSavedValue(parseInt(input));
//         setIsEditing(false);

//         // Call onMaxChange to save the value to parent component
//         if (onMaxChange) {
//             onMaxChange(parseInt(input));
//         }
//     };

//     const handleEdit = () => {
//         setIsEditing(true);
//     };

//     return (
//         <>
//             {isEditing ? (
//                 <div className="flex items-center gap-2">
//                     <div className="flex items-center gap-6">
//                         <p className="text-body">Allowed limit for {title} preference</p>
//                         <MyInput
//                             input={input}
//                             inputType="number"
//                             onChangeFunction={handleInputChange}
//                             className="w-[50px]"
//                             inputPlaceholder="1"
//                             disabled={isDisabled}
//                         />
//                     </div>
//                     <MyButton
//                         buttonType="primary"
//                         scale="medium"
//                         layoutVariant="icon"
//                         onClick={handleSave}
//                         type="button"
//                     >
//                         <Check />
//                     </MyButton>
//                 </div>
//             ) : (
//                 <div className="flex items-center justify-between rounded-md">
//                     <div className="flex flex-col">
//                         <p className="text-subtitle font-semibold">Maximum {title}s</p>
//                         <p className="text-body">{savedValue}</p>
//                     </div>
//                     <MyButton
//                         buttonType="secondary"
//                         scale="small"
//                         layoutVariant="icon"
//                         onClick={handleEdit}
//                         type="button"
//                     >
//                         <PencilSimple />
//                     </MyButton>
//                 </div>
//             )}
//         </>
//     );
// };
