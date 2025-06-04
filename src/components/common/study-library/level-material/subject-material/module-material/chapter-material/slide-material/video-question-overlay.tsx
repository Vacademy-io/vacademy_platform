// "use client";

// import { useState } from "react";
// import { X } from "lucide-react";
// import { useMutation } from "@tanstack/react-query";
// import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
// import { SUBMIT_SLIDE_ANSWERS } from "@/constants/urls";
// import { v4 as uuidv4 } from "uuid";
// import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
// import { Checkbox } from "@/components/ui/checkbox";
// import { getUserId } from "@/constants/getUserId";

// interface VideoQuestionProps {
//   question: {
//     id: string;
//     text_data: {
//       content: string;
//     };
//     parent_rich_text?: {
//       content: string;
//     };
//     options: Array<{
//       id: string;
//       text: {
//         content: string;
//       };
//     }>;
//     can_skip?: boolean;
//     question_type?: string;
//     auto_evaluation_json?: string;
//   };
//   onSubmit: (optionId: string | string[]) => Promise<any>;
//   onClose: () => void;
// }

// const VideoQuestionOverlay = ({
//   question,
//   onSubmit,
//   onClose,
// }: VideoQuestionProps) => {
//   const { activeItem } = useContentStore();
//   const [selectedOption, setSelectedOption] = useState<string | null>(null);
//   const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [response, setResponse] = useState<{
//     isCorrect: boolean;
//     explanation?: string;
//   } | null>(null);

//   // Determine if this is a multiple choice question
//   const isMultipleChoice = question.question_type === "MCQM";

//   const handleOptionToggle = (optionId: string) => {
//     if (response) return; // Don't allow changes after submission

//     setSelectedOptions((prev) => {
//       if (prev.includes(optionId)) {
//         return prev.filter((id) => id !== optionId);
//       } else {
//         return [...prev, optionId];
//       }
//     });
//   };

//   // Submit question answer mutation
//   const submitQuestionMutation = useMutation({
//     mutationFn: async (optionId: string | string[]) => {
//       if (!activeItem) throw new Error("No active item");

//       // Extract slideId and chapterId from URL
//       const urlParams = new URLSearchParams(window.location.search);
//       const slideId = urlParams.get("slideId") || "";
//       const userId = await getUserId();

//       if (!slideId || !userId) {
//         throw new Error("Missing slideId or userId in URL");
//       }

//       const payload = {
//         id: uuidv4(),
//         source_id: activeItem.source_id || "",
//         source_type: activeItem.source_type || "",
//         user_id: userId,
//         slide_id: slideId,
//         start_time_in_millis: Date.now() - 60000, // Assuming started 1 minute ago
//         end_time_in_millis: Date.now(),
//         percentage_watched: 0,
//         videos: [],
//         documents: [],
//         question_slides: [],
//         assignment_slides: [],
//         video_slides_questions: [
//           {
//             id: question.id,
//             response_json: JSON.stringify({
//               selectedOption: Array.isArray(optionId) ? optionId : [optionId],
//             }),
//             response_status: "SUBMITTED",
//           },
//         ],
//         new_activity: true,
//         concentration_score: {
//           id: uuidv4(),
//           concentration_score: 100,
//           tab_switch_count: 0,
//           pause_count: 0,
//           answer_times_in_seconds: [5],
//         },
//       };

//       return authenticatedAxiosInstance.post(SUBMIT_SLIDE_ANSWERS, payload, {
//         params: {
//           slideId,
//           userId,
//         },
//       });
//     },
//     onSuccess: () => {
//       console.log("Question answer submitted successfully");
//     },
//     onError: (error: any) => {
//       console.error("Error submitting question answer:", error);
//     },
//   });

//   const handleSubmit = async () => {
//     if (isSubmitting) return;

//     // Check if we have a valid selection
//     if (!isMultipleChoice && !selectedOption) return;
//     if (isMultipleChoice && selectedOptions.length === 0) return;

//     setIsSubmitting(true);
//     try {
//       // Get the selected option(s)
//       const selection = isMultipleChoice ? selectedOptions : selectedOption;

//       // Submit to local API
//       const result = await onSubmit(selection!);

//       // Submit to server API
//       submitQuestionMutation.mutate(selection!);

//       setResponse({
//         isCorrect: result.isCorrect,
//         explanation: result.explanation,
//       });
//     } catch (error) {
//       console.error("Error submitting answer:", error);
//       setResponse({
//         isCorrect: false,
//         explanation:
//           "There was an error processing your answer. Please try again.",
//       });
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
//       <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
//         <div className="sticky top-0 bg-white z-10 flex justify-between items-center p-5 border-b">
//           <h3 className="text-xl font-semibold text-orange-500">
//             Video Question
//           </h3>
//           {question.can_skip && !response && (
//             <button
//               onClick={onClose}
//               className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
//             >
//               Skip Question
//             </button>
//           )}
//           {!question.can_skip && !response && (
//             <div className="text-sm text-gray-500">
//               Answer required to continue
//             </div>
//           )}
//           {response && (
//             <button
//               onClick={onClose}
//               className="text-neutral-500 hover:text-neutral-700"
//             >
//               <X className="h-5 w-5" />
//             </button>
//           )}
//         </div>

//         <div className="p-5 overflow-y-auto">
//           <div className="mb-6">
//             <p className="text-lg text-neutral-800 font-medium mb-4">
//               {question.text_data.content}
//             </p>

//             {question.parent_rich_text?.content && (
//               <div className="mt-4 mb-6 bg-gray-50 p-4 rounded-lg">
//                 <img
//                   src="/placeholder.svg?height=250&width=500"
//                   alt="Question diagram"
//                   className="mx-auto rounded-lg mb-3"
//                 />
//                 <p className="text-sm text-neutral-600">
//                   {question.parent_rich_text.content}
//                 </p>
//               </div>
//             )}
//           </div>

//           <div className="mb-6">
//             <p className="text-md font-medium text-neutral-700 mb-3">
//               {isMultipleChoice
//                 ? "Select all that apply:"
//                 : "Select your answer:"}
//             </p>
//             <div className="space-y-3">
//               {question.options.map((option, index) => (
//                 <div
//                   key={option.id}
//                   onClick={() => {
//                     if (!response) {
//                       if (isMultipleChoice) {
//                         handleOptionToggle(option.id);
//                       } else {
//                         setSelectedOption(option.id);
//                       }
//                     }
//                   }}
//                   className={`flex items-center p-3 border rounded-md transition-all ${
//                     isMultipleChoice
//                       ? selectedOptions.includes(option.id)
//                         ? "border-orange-500 bg-orange-50"
//                         : "border-gray-200 hover:border-gray-300"
//                       : selectedOption === option.id
//                         ? "border-orange-500 bg-orange-50"
//                         : "border-gray-200 hover:border-gray-300"
//                   } ${response ? "cursor-default" : "cursor-pointer"}`}
//                 >
//                   <div className="flex-1">
//                     <span className="text-neutral-700">
//                       ({String.fromCharCode(65 + index)}) {option.text.content}
//                     </span>
//                   </div>
//                   <div className="ml-2">
//                     {isMultipleChoice ? (
//                       <Checkbox
//                         checked={selectedOptions.includes(option.id)}
//                         onCheckedChange={() => {
//                           if (!response) handleOptionToggle(option.id);
//                         }}
//                         disabled={!!response}
//                       />
//                     ) : (
//                       selectedOption === option.id && (
//                         <div className="h-4 w-4 rounded-full bg-orange-500"></div>
//                       )
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {response && (
//             <div
//               className={`p-4 rounded-md mb-6 ${
//                 response.isCorrect
//                   ? "bg-green-50 border border-green-200"
//                   : "bg-red-50 border border-red-200"
//               }`}
//             >
//               <p
//                 className={`text-md font-medium ${response.isCorrect ? "text-green-700" : "text-red-700"}`}
//               >
//                 {response.isCorrect ? "Correct!" : "Incorrect"}
//               </p>
//               {response.explanation && (
//                 <p className="mt-2 text-neutral-600">{response.explanation}</p>
//               )}
//             </div>
//           )}

//           <div className="flex justify-center">
//             {response ? (
//               <button
//                 onClick={onClose}
//                 className="px-6 py-2.5 bg-orange-500 text-white rounded-md font-medium hover:bg-orange-600 transition-colors"
//               >
//                 Continue Video
//               </button>
//             ) : (
//               <button
//                 onClick={handleSubmit}
//                 disabled={
//                   (!isMultipleChoice && !selectedOption) ||
//                   (isMultipleChoice && selectedOptions.length === 0) ||
//                   isSubmitting
//                 }
//                 className={`px-6 py-2.5 rounded-md font-medium transition-colors ${
//                   (!isMultipleChoice && !selectedOption) ||
//                   (isMultipleChoice && selectedOptions.length === 0) ||
//                   isSubmitting
//                     ? "bg-gray-300 text-gray-500 cursor-not-allowed"
//                     : "bg-orange-500 text-white hover:bg-orange-600"
//                 }`}
//               >
//                 {isSubmitting ? "Submitting..." : "Submit Answer"}
//               </button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default VideoQuestionOverlay;

// "use client";

// import type React from "react";

// import { useState, useEffect } from "react";
// import { X, Clock, CheckCircle } from "lucide-react";
// import { useMutation } from "@tanstack/react-query";
// import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
// import { SUBMIT_SLIDE_ANSWERS } from "@/constants/urls";
// import { v4 as uuidv4 } from "uuid";
// import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
// import { Checkbox } from "@/components/ui/checkbox";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent } from "@/components/ui/card";
// import { Textarea } from "@/components/ui/textarea";
// import { Input } from "@/components/ui/input";
// import { getUserId } from "@/constants/getUserId";

// interface VideoQuestionProps {
//   question: {
//     id: string;
//     question_time_in_millis: number;
//     text_data: {
//       content: string;
//     };
//     parent_rich_text?: {
//       content: string;
//     };
//     options: Array<{
//       id: string;
//       text: {
//         content: string;
//       };
//     }>;
//     can_skip?: boolean;
//     question_type?: string;
//     auto_evaluation_json?: string;
//     options_json?: string;
//   };
//   onSubmit: (optionId: string | string[]) => Promise<any>;
//   onClose: () => void;
//   videoDuration?: number;
//   allQuestions?: Array<{
//     id: string;
//     question_time_in_millis: number;
//     answered?: boolean;
//   }>;
// }

// const VideoQuestionOverlay = ({
//   question,
//   onSubmit,
//   onClose,
//   videoDuration = 0,
//   allQuestions = [],
// }: VideoQuestionProps) => {
//   const { activeItem } = useContentStore();
//   const [selectedOption, setSelectedOption] = useState<string | null>(null);
//   const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
//   const [inputValue, setInputValue] = useState("");
//   const [numericValue, setNumericValue] = useState("");
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [response, setResponse] = useState<{
//     isCorrect: boolean;
//     explanation?: string;
//   } | null>(null);

//   // Question type configuration
//   const questionType = question.question_type || "MCQS";
//   const isMultipleChoice = questionType === "MCQM";
//   const isTrueFalse = questionType === "TRUE_FALSE";
//   const isOneWord = questionType === "ONE_WORD";
//   const isLongAnswer = questionType === "LONG_ANSWER";
//   const isNumeric = questionType === "NUMERIC";

//   // Numeric configuration
//   const [isDecimal, setIsDecimal] = useState(false);
//   const [maxDecimals, setMaxDecimals] = useState(0);

//   // Parse numeric options
//   useEffect(() => {
//     if (isNumeric && question.options_json) {
//       try {
//         const options = JSON.parse(question.options_json);
//         setIsDecimal(options.numeric_type === "DECIMAL");
//         setMaxDecimals(options.decimals || 0);
//       } catch (error) {
//         console.error("Error parsing numeric options:", error);
//       }
//     }
//   }, [isNumeric, question.options_json]);

//   const handleOptionToggle = (optionId: string) => {
//     if (response) return;

//     if (isMultipleChoice) {
//       setSelectedOptions((prev) => {
//         if (prev.includes(optionId)) {
//           return prev.filter((id) => id !== optionId);
//         } else {
//           return [...prev, optionId];
//         }
//       });
//     } else {
//       setSelectedOption(optionId);
//     }
//   };

//   const handleInputChange = (
//     e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
//   ) => {
//     setInputValue(e.target.value);
//   };

//   const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = e.target.value;

//     if (isDecimal) {
//       if (/^-?\d*\.?\d*$/.test(value)) {
//         if (value.includes(".")) {
//           const parts = value.split(".");
//           if (parts[1].length <= maxDecimals) {
//             setNumericValue(value);
//           }
//         } else {
//           setNumericValue(value);
//         }
//       }
//     } else {
//       if (/^-?\d*$/.test(value)) {
//         setNumericValue(value);
//       }
//     }
//   };

//   const handleKeyPress = (key: string) => {
//     if (key === "backspace") {
//       setNumericValue((prev) => prev.slice(0, -1));
//     } else if (key === "clear") {
//       setNumericValue("");
//     } else if (key === "." && isDecimal && !numericValue.includes(".")) {
//       setNumericValue((prev) => prev + ".");
//     } else if (/[0-9]/.test(key)) {
//       setNumericValue((prev) => {
//         if (prev.includes(".")) {
//           const parts = prev.split(".");
//           if (parts[1].length >= maxDecimals) {
//             return prev;
//           }
//         }
//         return prev + key;
//       });
//     }
//   };

//   // Submit question answer mutation
//   const submitQuestionMutation = useMutation({
//     mutationFn: async (optionId: string | string[]) => {
//       if (!activeItem) throw new Error("No active item");

//       const urlParams = new URLSearchParams(window.location.search);
//       const slideId = urlParams.get("slideId") || "";
//       const userId = await getUserId();

//       if (!slideId || !userId) {
//         throw new Error("Missing slideId or userId in URL");
//       }

//       const payload = {
//         id: uuidv4(),
//         source_id: activeItem.source_id || "",
//         source_type: activeItem.source_type || "",
//         user_id: userId,
//         slide_id: slideId,
//         start_time_in_millis: Date.now() - 60000,
//         end_time_in_millis: Date.now(),
//         percentage_watched: 0,
//         videos: [],
//         documents: [],
//         question_slides: [],
//         assignment_slides: [],
//         video_slides_questions: [
//           {
//             id: question.id,
//             response_json: JSON.stringify({
//               selectedOption: Array.isArray(optionId) ? optionId : [optionId],
//             }),
//             response_status: "SUBMITTED",
//           },
//         ],
//         new_activity: true,
//         concentration_score: {
//           id: uuidv4(),
//           concentration_score: 100,
//           tab_switch_count: 0,
//           pause_count: 0,
//           answer_times_in_seconds: [5],
//         },
//       };

//       return authenticatedAxiosInstance.post(SUBMIT_SLIDE_ANSWERS, payload, {
//         params: { slideId, userId },
//       });
//     },
//     onSuccess: () => {
//       console.log("Question answer submitted successfully");
//     },
//     onError: (error: any) => {
//       console.error("Error submitting question answer:", error);
//     },
//   });

//   const handleSubmit = async () => {
//     if (isSubmitting) return;

//     // Validate input based on question type
//     let isValid = false;
//     let submissionValue: string | string[] = "";

//     if (questionType === "MCQS" || isTrueFalse) {
//       isValid = !!selectedOption;
//       submissionValue = selectedOption || "";
//     } else if (isMultipleChoice) {
//       isValid = selectedOptions.length > 0;
//       submissionValue = selectedOptions;
//     } else if (isOneWord || isLongAnswer) {
//       isValid = inputValue.trim().length > 0;
//       submissionValue = inputValue.trim();
//     } else if (isNumeric) {
//       isValid = numericValue.trim().length > 0;
//       submissionValue = numericValue.trim();
//     }

//     if (!isValid) return;

//     setIsSubmitting(true);
//     try {
//       const result = await onSubmit(submissionValue);
//       submitQuestionMutation.mutate(submissionValue);

//       setResponse({
//         isCorrect: result.isCorrect,
//         explanation: result.explanation,
//       });
//     } catch (error) {
//       console.error("Error submitting answer:", error);
//       setResponse({
//         isCorrect: false,
//         explanation:
//           "There was an error processing your answer. Please try again.",
//       });
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   // Progress bar with question markers
//   const renderProgressBar = () => {
//     if (!videoDuration || allQuestions.length === 0) return null;

//     const currentPosition =
//       (question.question_time_in_millis / 1000 / videoDuration) * 100;

//     return (
//       <div className="w-full mb-4">
//         <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
//           <span>Video Progress</span>
//           <span>
//             {Math.floor(question.question_time_in_millis / 1000 / 60)}:
//             {String(
//               Math.floor((question.question_time_in_millis / 1000) % 60)
//             ).padStart(2, "0")}
//           </span>
//         </div>
//         <div className="relative w-full h-2 bg-gray-200 rounded-full">
//           {/* Current position indicator */}
//           <div
//             className="absolute h-full bg-orange-500 rounded-full transition-all duration-300"
//             style={{ width: `${currentPosition}%` }}
//           />

//           {/* Question markers */}
//           {allQuestions.map((q, index) => {
//             const position =
//               (q.question_time_in_millis / 1000 / videoDuration) * 100;
//             const isCurrent = q.id === question.id;
//             const isAnswered = q.answered;

//             return (
//               <div
//                 key={q.id}
//                 className={`absolute w-3 h-3 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 top-1/2 ${
//                   isCurrent
//                     ? "bg-orange-500 scale-125 shadow-lg"
//                     : isAnswered
//                       ? "bg-green-500"
//                       : "bg-gray-400"
//                 }`}
//                 style={{ left: `${position}%` }}
//                 title={`Question ${index + 1}${isAnswered ? " (Answered)" : ""}`}
//               />
//             );
//           })}
//         </div>
//       </div>
//     );
//   };

//   // Render question content based on type
//   const renderQuestionContent = () => {
//     if (questionType === "MCQS" || isTrueFalse || isMultipleChoice) {
//       return (
//         <div className="space-y-3">
//           {question.options.map((option, index) => (
//             <div
//               key={option.id}
//               onClick={() => !response && handleOptionToggle(option.id)}
//               className={`flex items-center p-3 sm:p-4 border rounded-lg transition-all cursor-pointer hover:border-gray-300 ${
//                 (
//                   isMultipleChoice
//                     ? selectedOptions.includes(option.id)
//                     : selectedOption === option.id
//                 )
//                   ? "border-orange-500 bg-orange-50"
//                   : "border-gray-200"
//               } ${response ? "cursor-default opacity-75" : ""}`}
//             >
//               <div className="flex-1">
//                 <span className="text-sm sm:text-base text-gray-700">
//                   {isTrueFalse
//                     ? option.text.content
//                     : `${String.fromCharCode(65 + index)}. ${option.text.content}`}
//                 </span>
//               </div>
//               <div className="ml-3">
//                 {isMultipleChoice ? (
//                   <Checkbox
//                     checked={selectedOptions.includes(option.id)}
//                     onCheckedChange={() =>
//                       !response && handleOptionToggle(option.id)
//                     }
//                     disabled={!!response}
//                   />
//                 ) : (
//                   <div
//                     className={`w-5 h-5 rounded-full border-2 transition-all ${
//                       selectedOption === option.id
//                         ? "border-orange-500 bg-orange-500"
//                         : "border-gray-300"
//                     }`}
//                   >
//                     {selectedOption === option.id && (
//                       <div className="w-full h-full rounded-full bg-white scale-50" />
//                     )}
//                   </div>
//                 )}
//               </div>
//             </div>
//           ))}
//         </div>
//       );
//     }

//     if (isOneWord) {
//       return (
//         <div className="w-full">
//           <Input
//             type="text"
//             value={inputValue}
//             onChange={handleInputChange}
//             placeholder="Enter your answer"
//             className="w-full text-base py-3"
//             disabled={!!response}
//           />
//         </div>
//       );
//     }

//     if (isLongAnswer) {
//       return (
//         <div className="w-full">
//           <Textarea
//             value={inputValue}
//             onChange={handleInputChange}
//             placeholder="Type your detailed answer here..."
//             className="w-full min-h-[120px] text-base resize-none"
//             disabled={!!response}
//           />
//         </div>
//       );
//     }

//     if (isNumeric) {
//       return (
//         <div className="space-y-4">
//           <div className="w-full">
//             <Input
//               type="text"
//               value={numericValue}
//               onChange={handleNumericChange}
//               placeholder={
//                 isDecimal ? "Enter decimal value" : "Enter integer value"
//               }
//               className="w-full text-base py-3 text-center"
//               disabled={!!response}
//             />
//           </div>

//           {!response && (
//             <Card className="w-full max-w-xs mx-auto">
//               <CardContent className="p-3">
//                 <div className="grid grid-cols-3 gap-2">
//                   {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
//                     <Button
//                       key={num}
//                       variant="outline"
//                       size="sm"
//                       className="h-10 text-base"
//                       onClick={() => handleKeyPress(num.toString())}
//                     >
//                       {num}
//                     </Button>
//                   ))}
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     className="h-10 text-base"
//                     onClick={() => handleKeyPress("0")}
//                   >
//                     0
//                   </Button>
//                   {isDecimal && (
//                     <Button
//                       variant="outline"
//                       size="sm"
//                       className="h-10 text-base"
//                       onClick={() => handleKeyPress(".")}
//                       disabled={numericValue.includes(".")}
//                     >
//                       .
//                     </Button>
//                   )}
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     className="h-10 text-base"
//                     onClick={() => handleKeyPress("backspace")}
//                   >
//                     ←
//                   </Button>
//                 </div>
//                 <div className="grid grid-cols-1 gap-2 mt-2">
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     className="h-10 text-base"
//                     onClick={() => handleKeyPress("clear")}
//                   >
//                     Clear
//                   </Button>
//                 </div>
//               </CardContent>
//             </Card>
//           )}
//         </div>
//       );
//     }

//     return null;
//   };

//   const getQuestionTypeLabel = () => {
//     switch (questionType) {
//       case "MCQS":
//         return "Select one answer:";
//       case "TRUE_FALSE":
//         return "Select True or False:";
//       case "MCQM":
//         return "Select all that apply:";
//       case "ONE_WORD":
//         return "Enter your answer:";
//       case "LONG_ANSWER":
//         return "Provide a detailed answer:";
//       case "NUMERIC":
//         return "Enter the numeric value:";
//       default:
//         return "Answer the question:";
//     }
//   };

//   const isSubmitDisabled = () => {
//     if (isSubmitting || response) return true;

//     switch (questionType) {
//       case "MCQS":
//       case "TRUE_FALSE":
//         return !selectedOption;
//       case "MCQM":
//         return selectedOptions.length === 0;
//       case "ONE_WORD":
//       case "LONG_ANSWER":
//         return !inputValue.trim();
//       case "NUMERIC":
//         return !numericValue.trim();
//       default:
//         return true;
//     }
//   };

//   return (
//     <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
//       <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
//         {/* Header */}
//         <div className="sticky top-0 bg-white z-10 border-b border-gray-100">
//           <div className="flex items-center justify-between p-4 sm:p-6">
//             <div className="flex items-center gap-3">
//               <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
//                 <Clock className="w-4 h-4 text-orange-600" />
//               </div>
//               <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
//                 Video Question
//               </h3>
//             </div>

//             <div className="flex items-center gap-2">
//               {question.can_skip && !response && (
//                 <Button
//                   variant="ghost"
//                   size="sm"
//                   onClick={onClose}
//                   className="text-gray-600 hover:text-gray-800"
//                 >
//                   Skip Question
//                 </Button>
//               )}
//               {!question.can_skip && !response && (
//                 <span className="text-xs text-gray-500 hidden sm:block">
//                   Answer required to continue
//                 </span>
//               )}
//               {response && (
//                 <Button
//                   variant="ghost"
//                   size="sm"
//                   onClick={onClose}
//                   className="text-gray-600 hover:text-gray-800"
//                 >
//                   <X className="h-4 w-4" />
//                 </Button>
//               )}
//             </div>
//           </div>

//           {/* Progress bar */}
//           {renderProgressBar()}
//         </div>

//         {/* Content */}
//         <div className="p-4 sm:p-6 overflow-y-auto">
//           {/* Question text */}
//           <div className="mb-6">
//             <h4 className="text-base sm:text-lg font-medium text-gray-900 mb-3">
//               {question.text_data.content}
//             </h4>

//             {question.parent_rich_text?.content && (
//               <div className="mt-4 p-4 bg-gray-50 rounded-lg">
//                 <img
//                   src="/placeholder.svg?height=200&width=400"
//                   alt="Question diagram"
//                   className="mx-auto rounded-lg mb-3 max-w-full h-auto"
//                 />
//                 <p className="text-sm text-gray-600">
//                   {question.parent_rich_text.content}
//                 </p>
//               </div>
//             )}
//           </div>

//           {/* Question type label */}
//           <div className="mb-4">
//             <p className="text-sm font-medium text-gray-700">
//               {getQuestionTypeLabel()}
//             </p>
//           </div>

//           {/* Question content */}
//           <div className="mb-6">{renderQuestionContent()}</div>

//           {/* Response feedback */}
//           {response && (
//             <div
//               className={`p-4 rounded-lg mb-6 ${
//                 response.isCorrect
//                   ? "bg-green-50 border border-green-200"
//                   : "bg-red-50 border border-red-200"
//               }`}
//             >
//               <div className="flex items-center gap-2 mb-2">
//                 <CheckCircle
//                   className={`w-5 h-5 ${response.isCorrect ? "text-green-600" : "text-red-600"}`}
//                 />
//                 <p
//                   className={`font-medium ${response.isCorrect ? "text-green-800" : "text-red-800"}`}
//                 >
//                   {response.isCorrect ? "Correct!" : "Incorrect"}
//                 </p>
//               </div>
//               {response.explanation && (
//                 <p className="text-sm text-gray-700">{response.explanation}</p>
//               )}
//             </div>
//           )}

//           {/* Action buttons */}
//           <div className="flex flex-col sm:flex-row gap-3 justify-center">
//             {response ? (
//               <Button
//                 onClick={onClose}
//                 className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-8 py-2.5"
//               >
//                 Continue Video
//               </Button>
//             ) : (
//               <Button
//                 onClick={handleSubmit}
//                 disabled={isSubmitDisabled()}
//                 className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:text-gray-500 text-white px-8 py-2.5"
//               >
//                 {isSubmitting ? "Submitting..." : "Submit Answer"}
//               </Button>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default VideoQuestionOverlay;

"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { X, Clock, CheckCircle, XCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { SUBMIT_SLIDE_ANSWERS } from "@/constants/urls";
import { v4 as uuidv4 } from "uuid";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { getUserId } from "@/constants/getUserId";
import { processHtmlString } from "@/lib/utils";
import { MyButton } from "@/components/design-system/button";

interface VideoQuestionProps {
  question: {
    id: string;
    question_time_in_millis: number;
    text_data: {
      content: string;
    };
    parent_rich_text?: {
      content: string;
    };
    options: Array<{
      id: string;
      text: {
        content: string;
      };
      explanation_text_data?: {
        content: string;
      };
    }>;
    can_skip?: boolean;
    question_type?: string;
    auto_evaluation_json?: string;
    options_json?: string;
    explanation_text_data?: {
      content: string;
    };
  };
  onSubmit: (optionId: string | string[]) => Promise<any>;
  onClose: () => void;
  onPause?: () => void;
  videoDuration?: number;
  currentTime?: number;
  allQuestions?: Array<{
    id: string;
    question_time_in_millis: number;
    answered?: boolean;
  }>;
}

const VideoQuestionOverlay = ({
  question,
  onSubmit,
  onClose,
  onPause,
  // videoDuration = 0,
  // currentTime = 0,
  // allQuestions = [],
}: VideoQuestionProps) => {
  const { activeItem } = useContentStore();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [numericValue, setNumericValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<{
    isCorrect: boolean;
    explanation?: string;
    correctOptions?: string[];
    userOptions?: string[];
  } | null>(null);

  // Question type configuration
  const questionType = question.question_type || "MCQS";
  const isMultipleChoice = questionType === "MCQM";
  const isTrueFalse = questionType === "TRUE_FALSE";
  const isOneWord = questionType === "ONE_WORD";
  const isLongAnswer = questionType === "LONG_ANSWER";
  const isNumeric = questionType === "NUMERIC";

  // Numeric configuration
  const [isDecimal, setIsDecimal] = useState(false);
  const [maxDecimals, setMaxDecimals] = useState(0);

  // Pause video when dialog opens
  useEffect(() => {
    if (onPause) {
      onPause();
    }
  }, [onPause]);

  // Parse numeric options
  useEffect(() => {
    if (isNumeric && question.options_json) {
      try {
        const options = JSON.parse(question.options_json);
        setIsDecimal(options.numeric_type === "DECIMAL");
        setMaxDecimals(options.decimals || 0);
      } catch (error) {
        console.error("Error parsing numeric options:", error);
      }
    }
  }, [isNumeric, question.options_json]);

  const handleOptionToggle = (optionId: string) => {
    if (response) return;

    if (isMultipleChoice) {
      setSelectedOptions((prev) => {
        if (prev.includes(optionId)) {
          return prev.filter((id) => id !== optionId);
        } else {
          return [...prev, optionId];
        }
      });
    } else {
      setSelectedOption(optionId);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setInputValue(e.target.value);
  };

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (isDecimal) {
      if (/^-?\d*\.?\d*$/.test(value)) {
        if (value.includes(".")) {
          const parts = value.split(".");
          if (parts[1].length <= maxDecimals) {
            setNumericValue(value);
          }
        } else {
          setNumericValue(value);
        }
      }
    } else {
      if (/^-?\d*$/.test(value)) {
        setNumericValue(value);
      }
    }
  };

  const handleKeyPress = (key: string) => {
    if (key === "backspace") {
      setNumericValue((prev) => prev.slice(0, -1));
    } else if (key === "clear") {
      setNumericValue("");
    } else if (key === "." && isDecimal && !numericValue.includes(".")) {
      setNumericValue((prev) => prev + ".");
    } else if (/[0-9]/.test(key)) {
      setNumericValue((prev) => {
        if (prev.includes(".")) {
          const parts = prev.split(".");
          if (parts[1].length >= maxDecimals) {
            return prev;
          }
        }
        return prev + key;
      });
    }
  };

  // Evaluate answer against auto_evaluation_json
  const evaluateAnswer = (userAnswer: string | string[]) => {
    if (!question.auto_evaluation_json) {
      return { isCorrect: true, explanation: "Answer submitted successfully." };
    }

    try {
      const evaluation = JSON.parse(question.auto_evaluation_json);
      const correctOptionIds = evaluation.data?.correctOptionIds || [];
      const correctAnswer = evaluation.data?.correctAnswer;

      let isCorrect = false;
      let explanation = "";

      if (questionType === "MCQS" || isTrueFalse) {
        isCorrect = correctOptionIds.includes(userAnswer);
        explanation = isCorrect
          ? "Correct! Well done."
          : `Incorrect. The correct answer is: ${question.options.find((opt) => correctOptionIds.includes(opt.id))?.text.content || "Not found"}`;
      } else if (isMultipleChoice) {
        const userAnswerArray = Array.isArray(userAnswer)
          ? userAnswer
          : [userAnswer];
        isCorrect =
          correctOptionIds.length === userAnswerArray.length &&
          correctOptionIds.every((id: string) => userAnswerArray.includes(id));

        if (isCorrect) {
          explanation = "Correct! You selected all the right answers.";
        } else {
          const correctTexts = question.options
            .filter((opt) => correctOptionIds.includes(opt.id))
            .map((opt) => opt.text.content);
          explanation = `Incorrect. The correct answers are: ${correctTexts.join(", ")}`;
        }
      } else if (isOneWord || isLongAnswer || isNumeric) {
        if (correctAnswer) {
          isCorrect =
            String(userAnswer).toLowerCase().trim() ===
            String(correctAnswer).toLowerCase().trim();
          explanation = isCorrect
            ? "Correct! Well done."
            : `Incorrect. The correct answer is: ${correctAnswer}`;
        } else {
          isCorrect = true;
          explanation = "Answer submitted successfully.";
        }
      }

      // Add general explanation if available
      if (question.explanation_text_data?.content) {
        explanation += `\n\nExplanation: ${processHtmlString(question.explanation_text_data.content)
          .map((item) =>
        item.type === "text"
          ? item.content
          : `[Image: ${item.content}]`
          )
          .join(" ")}`;
      }

      return {
        isCorrect,
        explanation,
        correctOptions: correctOptionIds,
        userOptions: Array.isArray(userAnswer) ? userAnswer : [userAnswer],
      };
    } catch (error) {
      console.error("Error evaluating answer:", error);
      return { isCorrect: true, explanation: "Answer submitted successfully." };
    }
  };

  // Submit question answer mutation
  const submitQuestionMutation = useMutation({
    mutationFn: async (optionId: string | string[]) => {
      if (!activeItem) throw new Error("No active item");

      const urlParams = new URLSearchParams(window.location.search);
      const slideId = urlParams.get("slideId") || "";
      const userId = await getUserId();

      if (!slideId || !userId) {
        throw new Error("Missing slideId or userId in URL");
      }

      const payload = {
        id: uuidv4(),
        source_id: activeItem.source_id || "",
        source_type: activeItem.source_type || "",
        user_id: userId,
        slide_id: slideId,
        start_time_in_millis: Date.now() - 60000,
        end_time_in_millis: Date.now(),
        percentage_watched: 0,
        videos: [],
        documents: [],
        question_slides: [],
        assignment_slides: [],
        video_slides_questions: [
          {
            id: question.id,
            response_json: JSON.stringify({
              selectedOption: Array.isArray(optionId) ? optionId : [optionId],
            }),
            response_status: "SUBMITTED",
          },
        ],
        new_activity: true,
        concentration_score: {
          id: uuidv4(),
          concentration_score: 100,
          tab_switch_count: 0,
          pause_count: 0,
          answer_times_in_seconds: [5],
        },
      };

      return authenticatedAxiosInstance.post(SUBMIT_SLIDE_ANSWERS, payload, {
        params: { slideId, userId },
      });
    },
    onSuccess: () => {
      console.log("Question answer submitted successfully");
    },
    onError: (error: any) => {
      console.error("Error submitting question answer:", error);
    },
  });

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Validate input based on question type
    let isValid = false;
    let submissionValue: string | string[] = "";

    if (questionType === "MCQS" || isTrueFalse) {
      isValid = !!selectedOption;
      submissionValue = selectedOption || "";
    } else if (isMultipleChoice) {
      isValid = selectedOptions.length > 0;
      submissionValue = selectedOptions;
    } else if (isOneWord || isLongAnswer) {
      isValid = inputValue.trim().length > 0;
      submissionValue = inputValue.trim();
    } else if (isNumeric) {
      isValid = numericValue.trim().length > 0;
      submissionValue = numericValue.trim();
    }

    if (!isValid) return;

    setIsSubmitting(true);
    try {
      // Evaluate the answer
      const evaluation = evaluateAnswer(submissionValue);

      // Submit to API
      await onSubmit(submissionValue);
      submitQuestionMutation.mutate(submissionValue);

      // Wait for 5 seconds before showing the response
      setTimeout(() => {
        setResponse(evaluation);
      }, 5000);
    } catch (error) {
      console.error("Error submitting answer:", error);
      setResponse({
        isCorrect: false,
        explanation:
          "There was an error processing your answer. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format time helper
  // const formatTime = (timeInSeconds: number) => {
  //   const minutes = Math.floor(timeInSeconds / 60);
  //   const seconds = Math.floor(timeInSeconds % 60);
  //   return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  // };

  // Progress bar with question markers (matching the image design)
  // const renderProgressBar = () => {
  //   if (!videoDuration || allQuestions.length === 0) return null;

  //   const currentPosition = (currentTime / videoDuration) * 100;

  //   return (
  //     <div className="w-full mb-4 px-1">
  //       <div className="relative w-full h-1.5 bg-gradient-to-r from-red-400 via-orange-400 to-purple-400 rounded-full overflow-hidden">
  //         {/* Progress indicator */}
  //         <div
  //           className="absolute h-full bg-white/30 rounded-full transition-all duration-300"
  //           style={{ width: `${currentPosition}%` }}
  //         />

  //         {/* Question markers */}
  //         {allQuestions.map((q, index) => {
  //           const position =
  //             (q.question_time_in_millis / 1000 / videoDuration) * 100;
  //           const isCurrent = q.id === question.id;
  //           const isAnswered = q.answered;

  //           return (
  //             <div
  //               key={q.id}
  //               className={`absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 top-1/2 border-2 border-white shadow-sm ${
  //                 isCurrent
  //                   ? "bg-red-500 scale-125 shadow-lg z-10"
  //                   : isAnswered
  //                     ? "bg-green-500"
  //                     : "bg-red-400"
  //               }`}
  //               style={{ left: `${Math.max(1.5, Math.min(98.5, position))}%` }}
  //               title={`Question ${index + 1}${isAnswered ? " (Answered)" : ""}`}
  //             />
  //           );
  //         })}
  //       </div>

  //       {/* Time indicators */}
  //       <div className="flex justify-between text-xs text-gray-500 mt-2">
  //         <span>{formatTime(currentTime)}</span>
  //         <span>{formatTime(videoDuration)}</span>
  //       </div>
  //     </div>
  //   );
  // };

  // Get option status for styling
  const getOptionStatus = (optionId: string) => {
    if (!response) return "default";

    const isCorrect = response.correctOptions?.includes(optionId);
    const isSelected = isMultipleChoice
      ? selectedOptions.includes(optionId)
      : selectedOption === optionId;

    if (isSelected && isCorrect) return "correct-selected";
    if (isSelected && !isCorrect) return "incorrect-selected";
    if (!isSelected && isCorrect) return "correct-unselected";
    return "default";
  };

  // Render question content based on type
  const renderQuestionContent = () => {
    if (questionType === "MCQS" || isTrueFalse || isMultipleChoice) {
      return (
        <div className="space-y-3">
          {question.options.map((option, index) => {
            const status = getOptionStatus(option.id);

            return (
              <div
                key={option.id}
                onClick={() => !response && handleOptionToggle(option.id)}
                className={`flex items-center p-3 sm:p-4 border rounded-lg transition-all ${
                  response
                    ? "cursor-default"
                    : "cursor-pointer hover:border-gray-300"
                } ${
                  status === "correct-selected"
                    ? "border-green-500 bg-green-50"
                    : status === "incorrect-selected"
                      ? "border-red-500 bg-red-50"
                      : status === "correct-unselected"
                        ? "border-green-500 bg-green-50"
                        : (
                              isMultipleChoice
                                ? selectedOptions.includes(option.id)
                                : selectedOption === option.id
                            )
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200"
                }`}
              >
                <div className="flex-1">
                  <span className="text-sm sm:text-base text-gray-700">
                    {isTrueFalse
                      ? option.text.content
                      : `${String.fromCharCode(65 + index)}. ${option.text.content}`}
                  </span>
                </div>
                <div className="ml-3 flex items-center gap-2">
                  {isMultipleChoice ? (
                    <Checkbox
                      checked={selectedOptions.includes(option.id)}
                      onCheckedChange={() =>
                        !response && handleOptionToggle(option.id)
                      }
                      disabled={!!response}
                    />
                  ) : (
                    <div
                      className={`w-5 h-5 rounded-full border-2 transition-all ${
                        selectedOption === option.id
                          ? "border-orange-500 bg-orange-500"
                          : "border-gray-300"
                      }`}
                    >
                      {selectedOption === option.id && (
                        <div className="w-full h-full rounded-full bg-white scale-50" />
                      )}
                    </div>
                  )}

                  {/* Status icons */}
                  {response && (
                    <>
                      {status === "correct-selected" ||
                      status === "correct-unselected" ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : status === "incorrect-selected" ? (
                        <XCircle className="w-5 h-5 text-red-600" />
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (isOneWord) {
      return (
        <div className="w-full">
          <Input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter your answer"
            className="w-full text-base py-3"
            disabled={!!response}
          />
        </div>
      );
    }

    if (isLongAnswer) {
      return (
        <div className="w-full">
          <Textarea
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Type your detailed answer here..."
            className="w-full min-h-[120px] text-base resize-none"
            disabled={!!response}
          />
        </div>
      );
    }

    if (isNumeric) {
      return (
        <div className="space-y-4">
          <div className="w-full">
            <Input
              type="text"
              value={numericValue}
              onChange={handleNumericChange}
              placeholder={
                isDecimal ? "Enter decimal value" : "Enter integer value"
              }
              className="w-full text-base py-3 text-center"
              disabled={!!response}
            />
          </div>

          {!response && (
            <Card className="w-full max-w-xs mx-auto">
              <CardContent className="p-3">
                <div className="grid grid-cols-3 gap-2">
                  {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                    <Button
                      key={num}
                      variant="outline"
                      size="sm"
                      className="h-10 text-base"
                      onClick={() => handleKeyPress(num.toString())}
                    >
                      {num}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 text-base"
                    onClick={() => handleKeyPress("0")}
                  >
                    0
                  </Button>
                  {isDecimal && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-base"
                      onClick={() => handleKeyPress(".")}
                      disabled={numericValue.includes(".")}
                    >
                      .
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 text-base"
                    onClick={() => handleKeyPress("backspace")}
                  >
                    ←
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 text-base"
                    onClick={() => handleKeyPress("clear")}
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    return null;
  };

  const getQuestionTypeLabel = () => {
    switch (questionType) {
      case "MCQS":
        return "Select one answer:";
      case "TRUE_FALSE":
        return "Select True or False:";
      case "MCQM":
        return "Select all that apply:";
      case "ONE_WORD":
        return "Enter your answer:";
      case "LONG_ANSWER":
        return "Provide a detailed answer:";
      case "NUMERIC":
        return "Enter the numeric value:";
      default:
        return "Answer the question:";
    }
  };

  const isSubmitDisabled = () => {
    if (isSubmitting || response) return true;

    switch (questionType) {
      case "MCQS":
      case "TRUE_FALSE":
        return !selectedOption;
      case "MCQM":
        return selectedOptions.length === 0;
      case "ONE_WORD":
      case "LONG_ANSWER":
        return !inputValue.trim();
      case "NUMERIC":
        return !numericValue.trim();
      default:
        return true;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-100">
          <div className="flex items-center justify-between p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock className="w-4 h-4 text-orange-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                Video Question
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {question.can_skip && !response && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-gray-600 hover:text-gray-800"
                >
                  Skip Question
                </Button>
              )}
              {!question.can_skip && !response && (
                <span className="text-xs text-gray-500 hidden sm:block">
                  Answer required to continue
                </span>
              )}
              {response && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {/* {renderProgressBar()} */}
        </div>

        {/* Content - Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Question text */}
          <div className="mb-6">
            <h4 className="text-base sm:text-lg font-medium text-gray-900 mb-3">
              {/* {question.text_data.content.replace(/<[^>]*>/g, "")} */}
            </h4>

            {question.parent_rich_text?.content && (
              <div className="flex">
                <p>Question :    </p>
              {processHtmlString(question.parent_rich_text.content).map(
                (item, index) =>
                item.type === "text" ? (
                  <p className="" key={index}>
                  {item.content}
                  </p>
                ) : (
                  <img
                  key={index}
                  src={item.content}
                  alt={`Question context ${index}`}
                  className="mx-auto rounded-lg mb-3 max-w-full h-auto"
                  />
                )
              )}
              </div>
            )}
          </div>

          {/* Question type label */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700">
              {getQuestionTypeLabel()}
            </p>
          </div>

          {/* Question content */}
          <div className="mb-6">{renderQuestionContent()}</div>

          {/* Response feedback */}
          {response && (
            <div
              className={`p-4 rounded-lg mb-6 ${
                response.isCorrect
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {response.isCorrect ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <p
                  className={`font-medium ${response.isCorrect ? "text-green-800" : "text-red-800"}`}
                >
                  {response.isCorrect ? "Correct!" : "Incorrect"}
                </p>
              </div>
              {response.explanation && (
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {response.explanation}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer - Action buttons */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {response ? (
              <MyButton
              buttonType="secondary"
              scale="medium"
              layoutVariant="icon"
              onClick={onClose}
              disable={false}
              >
              Continue Video
              </MyButton>
            ) : (
              <MyButton
              buttonType="primary"
              
              onClick={handleSubmit}
              disable={isSubmitDisabled()}
              >
              {isSubmitting ? "Submitting..." : "Submit Answer"}
              </MyButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoQuestionOverlay;
