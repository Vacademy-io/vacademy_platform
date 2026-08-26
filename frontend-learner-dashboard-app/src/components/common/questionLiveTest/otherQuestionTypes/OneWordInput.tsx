import { useAssessmentStore } from "@/stores/assessment-store";
import { cn } from "@/lib/utils";

export function OneWordInput() {
  const { currentQuestion, answers, setAnswer, setQuestionState } =
    useAssessmentStore();
  const currentAnswer =
    (currentQuestion && answers[currentQuestion.question_id]?.[0]) || "";

  return (
    <div>
      <p className="mb-2 text-3xs font-bold uppercase tracking-wide text-neutral-400">
        Your answer
      </p>
      <input
        type="text"
        value={currentAnswer}
        onChange={(event) => {
          if (!currentQuestion) return;
          setAnswer(currentQuestion.question_id, [event.target.value]);
          setQuestionState(currentQuestion.question_id, { isVisited: true });
        }}
        placeholder="Type your one-word answer"
        aria-label="Your answer"
        // Copy/cut/paste stay blocked here for the same reason as the rest of
        // the live test — pasted answers defeat the proctoring rules.
        onCopy={(event) => event.preventDefault()}
        onCut={(event) => event.preventDefault()}
        onPaste={(event) => event.preventDefault()}
        className={cn(
          "h-12 w-full rounded-xl border-2 px-4 text-subtitle text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 md:max-w-reg-450",
          currentAnswer ? "border-primary-500" : "border-neutral-200",
        )}
      />
    </div>
  );
}
