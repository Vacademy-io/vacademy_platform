import { StatusCheck } from "@/components/design-system/chips";
import { formatDuration } from "@/constants/helper";
import { Assessment } from "@/types/assessment";

interface AssessmentInstructionsProps {
  instructions: string;
  duration: number;
  preview: boolean;
  canSwitchSections: boolean;
  assessmentInfo: Assessment;
}

const getAttemptLabel = (assessmentInfo: Assessment) => {
  const max_posible_attempts =
    (assessmentInfo.user_attempts ?? 0) !== 0
      ? (assessmentInfo.user_attempts ?? 1)
      : (assessmentInfo.assessment_attempts ?? 1);
  const total_given_attempts = assessmentInfo.created_attempts ?? 0;

  // Display the current attempt status
  return `${total_given_attempts}/${max_posible_attempts}`;
};

export const AssessmentInstructions = ({
  instructions,
  duration,
  preview,
  canSwitchSections,
  assessmentInfo,
}: AssessmentInstructionsProps) => {
  const attempt = getAttemptLabel(assessmentInfo);
  return (
    <div className="w-full sm:w-screen">
      {assessmentInfo.play_mode !== "PRACTICE" &&
        assessmentInfo.play_mode !== "MOCK" && (
          <div className="flex justify-start text-primary-500 text-sm font-normal mb-2">
            Attempt no: <span className="font-bold">{attempt}</span>
          </div>
        )}

      <div className="font-bold text-lg mb-2">Assessment Instructions</div>
      <div
        className="text-gray-700 text-sm font-normal mb-4"
        dangerouslySetInnerHTML={{ __html: instructions }}
      ></div>

      <div className="mt-4 gap-4 text-sm font-bold">
        <div className="mb-4">
          Assessment Duration:
          <div className="flex items-center gap-2 font-normal">
            <div>Entire Assessment Duration</div>
            <span>{formatDuration(duration * 60)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-gray-600 font-normal mb-4">
          <div className="font-bold">
            Assessment Preview:{" "}
            <span className="font-normal">{preview ? "Yes" : "No"}</span>
          </div>
          {preview && <StatusCheck />}
        </div>
        <div className="flex items-center justify-between text-gray-600 font-normal mb-4">
          <div className="font-bold">
            Switch between sections:{" "}
            <span className="font-normal">
              {canSwitchSections ? "Yes" : "No"}
            </span>
          </div>
          {canSwitchSections && <StatusCheck />}
        </div>
      </div>
    </div>
  );
};
