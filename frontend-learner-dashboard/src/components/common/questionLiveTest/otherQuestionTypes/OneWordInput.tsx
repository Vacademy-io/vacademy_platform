import { MyInput } from "@/components/design-system/input";
import { useAssessmentStore } from "@/stores/assessment-store";

// export function OneWordInput() {
//   const { currentQuestion, answers, setAnswer } = useAssessmentStore();
//   const currentAnswer =
//     (currentQuestion && answers[currentQuestion.question_id]?.[0]) || "";

//   return (
//     <MyInput
//       type="text"
//       value={currentAnswer}
//       onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
//         if (currentQuestion) {
//           setAnswer(currentQuestion.question_id, [e.target.value]);
//         }
//       }}
//       placeholder="Type your one-word answer"
//     />
//   );
// }

export function OneWordInput() {
  const { currentQuestion, answers, setAnswer } = useAssessmentStore();
  const currentAnswer =
    (currentQuestion && answers[currentQuestion.question_id]?.[0]) || "";

  return (
    <MyInput
      inputType="text"
      input={currentAnswer}
      onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) => {
        if (currentQuestion) {
          setAnswer(currentQuestion.question_id, [e.target.value]);
        }
      }}
      inputPlaceholder="Type your one-word answer"
      onCopy={(e) => e.preventDefault()} 
      onCut={(e) => e.preventDefault()}  
      onPaste={(e) => e.preventDefault()}
    />
  );
}
