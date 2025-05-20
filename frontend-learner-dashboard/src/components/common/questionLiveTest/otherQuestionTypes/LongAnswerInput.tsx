import { Textarea } from "@/components/ui/textarea";
import { useAssessmentStore } from "@/stores/assessment-store";

export function LongAnswerInput() {
  const { currentQuestion, answers, setAnswer } = useAssessmentStore();
  if (!currentQuestion) {
    return null;
  }

  const currentAnswer = answers[currentQuestion.question_id]?.[0] || "";

  return (
    <Textarea
      value={currentAnswer}
      onChange={(e) => setAnswer(currentQuestion.question_id, [e.target.value])}
      placeholder="Type your answer..."
      rows={5}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
    />
  );
}
