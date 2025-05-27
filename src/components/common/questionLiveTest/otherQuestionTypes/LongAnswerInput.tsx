import { Textarea } from "@/components/ui/textarea";
import { useAssessmentStore } from "@/stores/assessment-store";

export function LongAnswerInput() {
  const { currentQuestion, answers, setAnswer, setQuestionState } =
    useAssessmentStore();
  if (!currentQuestion) {
    return null;
  }

  const currentAnswer = answers[currentQuestion.question_id]?.[0] || "";

  const disableCopyCutPaste = {
    onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
    onCut: (e: React.ClipboardEvent) => e.preventDefault(),
    onPaste: (e: React.ClipboardEvent) => e.preventDefault(),
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAnswer(currentQuestion.question_id, [e.target.value]);
    setQuestionState(currentQuestion.question_id, { isVisited: true });
  };

  return (
    <Textarea
      value={currentAnswer}
      onChange={handleChange}
      placeholder="Type your answer..."
      rows={5}
      {...disableCopyCutPaste}
    />
  );
}
