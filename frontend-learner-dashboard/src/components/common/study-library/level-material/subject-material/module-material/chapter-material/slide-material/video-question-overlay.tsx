// "use client";

// import { useState } from "react";
// import { X } from "lucide-react";

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
//   };
//   onSubmit: (optionId: string) => Promise<any>;
//   onClose: () => void;
// }

// const VideoQuestionOverlay = ({
//   question,
//   onSubmit,
//   onClose,
// }: VideoQuestionProps) => {
//   const [selectedOption, setSelectedOption] = useState<string | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [response, setResponse] = useState<{
//     isCorrect: boolean;
//     explanation?: string;
//   } | null>(null);

//   const handleSubmit = async () => {
//     if (!selectedOption || isSubmitting) return;

//     setIsSubmitting(true);
//     try {
//       const result = await onSubmit(selectedOption);
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
//     <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
//       <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
//         <div className="flex justify-between items-center mb-4">
//           <h3 className="text-lg font-semibold text-orange-500">
//             Video Question
//           </h3>
//           <button
//             onClick={onClose}
//             className="text-neutral-500 hover:text-neutral-700"
//           >
//             <X className="h-5 w-5" />
//           </button>
//         </div>

//         <div className="mb-4">
//           <p className="text-neutral-800 font-medium">
//             {question.text_data.content}
//           </p>

//           {question.parent_rich_text?.content && (
//             <div className="mt-2">
//               <img
//                 src="/placeholder.svg?height=150&width=300"
//                 alt="Question diagram"
//                 className="mx-auto rounded-lg mb-2"
//               />
//               <p className="text-sm text-neutral-500 text-center">
//                 Eye diagram
//               </p>
//             </div>
//           )}
//         </div>

//         <div className="mb-6">
//           <p className="text-sm font-medium text-neutral-700 mb-2">Answer:</p>
//           <div className="space-y-2">
//             {question.options.map((option, index) => (
//               <div
//                 key={option.id}
//                 onClick={() => !response && setSelectedOption(option.id)}
//                 className={`flex items-center p-2 border rounded-md cursor-pointer transition-all ${
//                   selectedOption === option.id
//                     ? "border-orange-500 bg-orange-50"
//                     : "border-gray-200 hover:border-gray-300"
//                 } ${response ? "cursor-default" : "cursor-pointer"}`}
//               >
//                 <div className="flex-1">
//                   <span className="text-sm text-neutral-600">
//                     ({String.fromCharCode(97 + index)}) {option.text.content}
//                   </span>
//                 </div>
//                 <div className="ml-2">
//                   {selectedOption === option.id && (
//                     <div className="h-4 w-4 rounded-full bg-orange-500"></div>
//                   )}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>

//         {response && (
//           <div
//             className={`p-3 rounded-md mb-4 ${
//               response.isCorrect
//                 ? "bg-green-50 border border-green-200"
//                 : "bg-red-50 border border-red-200"
//             }`}
//           >
//             <p
//               className={`text-sm font-medium ${response.isCorrect ? "text-green-700" : "text-red-700"}`}
//             >
//               {response.isCorrect ? "Correct!" : "Incorrect"}
//             </p>
//             {response.explanation && (
//               <p className="text-xs mt-1 text-neutral-600">
//                 {response.explanation}
//               </p>
//             )}
//           </div>
//         )}

//         <div className="flex justify-center">
//           {response ? (
//             <button
//               onClick={onClose}
//               className="px-5 py-2 bg-orange-500 text-white rounded-md font-medium hover:bg-orange-600 transition-colors"
//             >
//               Continue Video
//             </button>
//           ) : (
//             <button
//               onClick={handleSubmit}
//               disabled={!selectedOption || isSubmitting}
//               className={`px-5 py-2 rounded-md font-medium transition-colors ${
//                 !selectedOption || isSubmitting
//                   ? "bg-gray-300 text-gray-500 cursor-not-allowed"
//                   : "bg-orange-500 text-white hover:bg-orange-600"
//               }`}
//             >
//               {isSubmitting ? "Submitting..." : "Submit"}
//             </button>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default VideoQuestionOverlay;



"use client"

import { useState } from "react"
import { X } from "lucide-react"

interface VideoQuestionProps {
  question: {
    id: string
    text_data: {
      content: string
    }
    parent_rich_text?: {
      content: string
    }
    options: Array<{
      id: string
      text: {
        content: string
      }
    }>
  }
  onSubmit: (optionId: string) => Promise<any>
  onClose: () => void
  canSkip?: boolean
}

const VideoQuestionOverlay = ({ question, onSubmit, onClose, canSkip = false }: VideoQuestionProps) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [response, setResponse] = useState<{
    isCorrect: boolean
    explanation?: string
  } | null>(null)

  const handleSubmit = async () => {
    if (!selectedOption || isSubmitting) return

    setIsSubmitting(true)
    try {
      const result = await onSubmit(selectedOption)
      setResponse({
        isCorrect: result.isCorrect,
        explanation: result.explanation,
      })
    } catch (error) {
      console.error("Error submitting answer:", error)
      setResponse({
        isCorrect: false,
        explanation: "There was an error processing your answer. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="sticky top-0 bg-white z-10 flex justify-between items-center p-5 border-b">
          <h3 className="text-xl font-semibold text-orange-500">Video Question</h3>
          {canSkip && !response && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
            >
              Skip Question
            </button>
          )}
          {!canSkip && !response && <div className="text-sm text-gray-500">Answer required to continue</div>}
          {response && (
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="p-5 overflow-y-auto">
          <div className="mb-6">
            <p className="text-lg text-neutral-800 font-medium mb-4">{question.text_data.content}</p>

            {question.parent_rich_text?.content && (
              <div className="mt-4 mb-6 bg-gray-50 p-4 rounded-lg">
                <img
                  src="/placeholder.svg?height=250&width=500"
                  alt="Question diagram"
                  className="mx-auto rounded-lg mb-3"
                />
                <p className="text-sm text-neutral-600">{question.parent_rich_text.content}</p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <p className="text-md font-medium text-neutral-700 mb-3">Select your answer:</p>
            <div className="space-y-3">
              {question.options.map((option, index) => (
                <div
                  key={option.id}
                  onClick={() => !response && setSelectedOption(option.id)}
                  className={`flex items-center p-3 border rounded-md transition-all ${
                    selectedOption === option.id
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                  } ${response ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="flex-1">
                    <span className="text-neutral-700">
                      ({String.fromCharCode(65 + index)}) {option.text.content}
                    </span>
                  </div>
                  <div className="ml-2">
                    {selectedOption === option.id && <div className="h-4 w-4 rounded-full bg-orange-500"></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {response && (
            <div
              className={`p-4 rounded-md mb-6 ${
                response.isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
              }`}
            >
              <p className={`text-md font-medium ${response.isCorrect ? "text-green-700" : "text-red-700"}`}>
                {response.isCorrect ? "Correct!" : "Incorrect"}
              </p>
              {response.explanation && <p className="mt-2 text-neutral-600">{response.explanation}</p>}
            </div>
          )}

          <div className="flex justify-center">
            {response ? (
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-md font-medium hover:bg-orange-600 transition-colors"
              >
                Continue Video
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!selectedOption || isSubmitting}
                className={`px-6 py-2.5 rounded-md font-medium transition-colors ${
                  !selectedOption || isSubmitting
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-orange-500 text-white hover:bg-orange-600"
                }`}
              >
                {isSubmitting ? "Submitting..." : "Submit Answer"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoQuestionOverlay
