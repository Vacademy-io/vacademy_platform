import { Card } from "@/components/ui/card";
import { useNavigate } from "@tanstack/react-router";
import { MyButton } from "@/components/design-system/button";
import { PlayMode, StatusChip } from "@/components/design-system/chips";
import { assessmentTypes } from "@/types/assessment";
import { Assessment } from "@/types/assessment";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { restartAssessment } from "../-utils.ts/useFetchRestartAssessment";
import {
  storeAssessmentInfo,
  fetchPreviewData,
} from "../-utils.ts/useFetchAssessment";
import { formatDuration } from "@/constants/helper";
import { toast } from "sonner";

interface AssessmentProps {
  assessmentInfo: Assessment;
  assessmentType: assessmentTypes;
  assessment_types: string;
}

const playModeColors: { [key: string]: string } = {
  EXAM: "bg-green-500 text-white",
  MOCK: "bg-purple-500 text-white",
  PRACTICE: "bg-blue-500 text-white",
  SURVEY: "bg-red-500 text-white",
};

export const AssessmentCard = ({
  assessmentInfo,
  assessmentType,
  assessment_types,
}: AssessmentProps) => {
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [showSurveyConfirmDialog, setShowSurveyConfirmDialog] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const handleClosePopup = () => setShowPopup(false);
  const handleCloseRestartDialog = () => setShowRestartDialog(false);
  const handleCloseSurveyConfirmDialog = () =>
    setShowSurveyConfirmDialog(false);

  const handleSurveyConfirm = async () => {
    try {
      await fetchPreviewData(assessmentInfo.assessment_id);
      navigate({
        to: `/assessment/examination/${assessmentInfo.assessment_id}/LearnerLiveTest`,
      });
    } catch (error) {
      console.error("Error fetching survey data:", error);
      toast.error("Failed to start survey. Please try again.");
    }
    setShowSurveyConfirmDialog(false);
  };

  const handleOpen = () => {
    if (assessmentType === assessmentTypes.UPCOMING) {
      setShowPopup(true);
    }
  };

  const handleAction = async () => {
    if (
      ["LIVE", "PREVIEW"].includes(assessmentInfo?.recent_attempt_status ?? "")
    ) {
      setShowRestartDialog(true);
      return;
    }

    if (
      assessmentInfo.recent_attempt_status === "ENDED" ||
      assessmentInfo.recent_attempt_status === null
    ) {
      const max_posible_attempts =
        assessmentInfo.user_attempts !== 0
          ? assessmentInfo.user_attempts
          : assessmentInfo.assessment_attempts ?? 1;
      const total_given_attempts = assessmentInfo.created_attempts ?? 0;

      if ((max_posible_attempts ?? 1) > total_given_attempts) {
        storeAssessmentInfo(assessmentInfo);

        // For Survey assessments, show confirmation dialog
        if (assessmentInfo.play_mode === "SURVEY") {
          setShowSurveyConfirmDialog(true);
        } else {
          navigate({
            to: `/assessment/examination/${assessmentInfo.assessment_id}`,
          });
        }
      } else {
        return;
      }
    } else {
      storeAssessmentInfo(assessmentInfo);

      // For Survey assessments, show confirmation dialog
      if (assessmentInfo.play_mode === "SURVEY") {
        setShowSurveyConfirmDialog(true);
      } else {
        navigate({
          to: `/assessment/examination/${assessmentInfo.assessment_id}`,
        });
      }
    }
  };

  const handleRestartAssessment = async () => {
    setIsRestarting(true);
    try {
      await storeAssessmentInfo(assessmentInfo);

      const isRestarted = await restartAssessment(
        assessmentInfo.assessment_id,
        assessmentInfo.last_attempt_id ?? ""
      );
      console.log("assessmentInfo", assessmentInfo);

      console.log("Restart API Response:", isRestarted);

      if (isRestarted) {
        console.log(
          "Navigating to:",
          `/assessment/examination/${assessmentInfo.assessment_id}/LearnerLiveTest`
        );
        navigate({
          to: `/assessment/examination/${assessmentInfo.assessment_id}/LearnerLiveTest`,
          replace: true,
        });
        return;
      } else {
        toast.error(
          "Failed to resume the assessment. Assessment already Ended."
        );
      }
    } catch (error) {
      console.error("Error in handleRestartAssessment:", error);
      toast.error("An error occurred while resuming the assessment.");
    }

    setIsRestarting(false);
    setShowRestartDialog(false);
  };

  const getButtonLabel = () => {
    if (
      ["LIVE", "PREVIEW"].includes(assessmentInfo?.recent_attempt_status ?? "")
    ) {
      return "Resume";
    }
    console.log(assessmentInfo.recent_attempt_status);
    if (
      assessmentInfo.recent_attempt_status === "ENDED" ||
      assessmentInfo.recent_attempt_status === null
    ) {
      const max_posible_attempts =
        assessmentInfo.user_attempts !== 0
          ? assessmentInfo.user_attempts
          : assessmentInfo.assessment_attempts ?? 1;
      const total_given_attempts = assessmentInfo.created_attempts ?? 0;

      if ((max_posible_attempts ?? 1) > total_given_attempts) {
        return "Join Assessment";
      } else {
        return "Ended";
      }
    }
    return "Join Assessment";
  };

  const handleAttemptEligibility = () => {
    const label = getButtonLabel();
    if (label === "Ended") {
      return true;
    }
    return false;
  };

  // const getButtonLabel = () => {
  //   if (
  //     ["LIVE", "PREVIEW"].includes(assessmentInfo?.recent_attempt_status ?? "")
  //   ) {
  //     return "Resume";
  //   }

  //   if (
  //     assessmentInfo.recent_attempt_status === "ENDED" ||
  //     assessmentInfo.recent_attempt_status === null
  //   ) {
  //     const max_posible_attempts =
  //       assessmentInfo.user_attempts ?? assessmentInfo.assessment_attempts ?? 0;

  //     const total_given_attempts = assessmentInfo.created_attempts ?? 1;

  //     if (max_posible_attempts < total_given_attempts) {
  //       return "Join Assessment";
  //     } else {
  //       return "Ended";
  //     }
  //   }

  //   return "Join Assessment";
  // };

  return (
    <>
      <Card
        className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6"
        onClick={handleOpen}
      >
        <h2 className="text-base sm:text-sm lg:text-base font-semibold break-words">
          {assessmentInfo.name}
        </h2>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
          <div>
            {assessment_types == "ASSESSMENT" && (
              <div className="flex gap-2 sm:gap-3 pb-2 sm:pb-3 items-center">
                <StatusChip
                  playMode={assessmentInfo.play_mode as PlayMode}
                  className={
                    playModeColors[assessmentInfo.play_mode as PlayMode]
                  }
                />
              </div>
            )}
            {assessmentInfo.play_mode !== "PRACTICE" && (
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm lg:text-sm text-gray-600">
                {assessmentInfo.play_mode !== "MOCK" && (
                  <>
                    <div>
                      Start Date and Time:{" "}
                      {dayjs(assessmentInfo.bound_start_time).format(
                        "DD MMM YYYY, hh:mm A"
                      )}
                    </div>
                    <div>
                      End Date and Time:{" "}
                      {dayjs(assessmentInfo.bound_end_time).format(
                        "DD MMM YYYY, hh:mm A"
                      )}
                    </div>
                  </>
                )}
                {assessmentInfo.duration &&
                  assessmentInfo.play_mode !== "SURVEY" && (
                    <div>
                      Duration: {formatDuration(assessmentInfo.duration * 60)}
                    </div>
                  )}
                <div>
                  Attempts: {assessmentInfo.created_attempts ?? 0} /{" "}
                  {assessmentInfo.user_attempts !== 0 &&
                  assessmentInfo.user_attempts !== null
                    ? assessmentInfo.user_attempts
                    : assessmentInfo.assessment_attempts ?? 0}
                </div>
              </div>
            )}
          </div>
          {/* {assessmentType !== assessmentTypes.UPCOMING &&
            assessmentType !== assessmentTypes.PAST && (
              <div className="w-full md:w-auto">
                <MyButton
                  buttonType="secondary"
                  className="w-full max-w-xs md:w-[200px] lg:w-[300px]"
                  onClick={handleAction}
                  disabled={assessmentInfo.recent_attempt_status === "ENDED"}
                >
                  {getButtonLabel()}
                </MyButton>
              </div>
            )} */}
          {assessmentType !== assessmentTypes.UPCOMING &&
            assessmentType !== assessmentTypes.PAST && (
              <div className="w-full md:w-auto">
                <MyButton
                  buttonType="secondary"
                  className="w-full max-w-xs md:w-[200px] lg:w-[300px]"
                  onClick={handleAction}
                  disabled={handleAttemptEligibility()}
                >
                  {getButtonLabel()}
                </MyButton>
              </div>
            )}

          {assessmentType === assessmentTypes.PAST &&
            (assessmentInfo.created_attempts ?? 0) > 0 && (
              <div className="w-full md:w-auto">
                <MyButton
                  buttonType="secondary"
                  className="w-full sm:max-w-xs md:w-[200px] lg:w-[300px]"
                  onClick={() =>
                    navigate({
                      to: `/assessment/reports/student-report`,
                      search: {
                        assessmentId: assessmentInfo.assessment_id,
                        attemptId: assessmentInfo.last_attempt_id ?? "",
                      },
                      state: {
                        playMode: assessmentInfo.play_mode,
                        assessmentInfo: assessmentInfo,
                      } as any,
                    })
                  }
                >
                  Show Report
                </MyButton>
              </div>
            )}
        </div>
      </Card>

      {/* Pop-up for Upcoming Tests */}
      <Dialog open={showPopup} onOpenChange={handleClosePopup}>
        <DialogContent className="max-w-sm bg-[#FDFAF6] rounded-lg p-4 sm:mx-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-gray-700">
              Assessment Not Available
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-gray-700">
            The assessment is not live currently. You can appear for the
            assessment when it goes live.
          </DialogDescription>
        </DialogContent>
      </Dialog>

      {/* Resume Confirmation Dialog */}
      <AlertDialog
        open={showRestartDialog}
        onOpenChange={handleCloseRestartDialog}
      >
        <AlertDialogOverlay className="bg-black/50" />
        <AlertDialogContent className="max-w-sm bg-white rounded-lg p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>Resume Assessment</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="text-gray-700">
            Would you like to continue the assessment from your last saved
            progress?
          </AlertDialogDescription>
          <AlertDialogFooter className="flex justify-end gap-3 mt-4">
            <MyButton buttonType="secondary" onClick={handleCloseRestartDialog}>
              Cancel
            </MyButton>
            <MyButton
              buttonType="primary"
              onClick={handleRestartAssessment}
              disabled={isRestarting}
            >
              {isRestarting ? "Proceeding..." : "Resume"}
            </MyButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Survey Confirmation Dialog */}
      <AlertDialog
        open={showSurveyConfirmDialog}
        onOpenChange={handleCloseSurveyConfirmDialog}
      >
        <AlertDialogOverlay className="bg-black/50" />
        <AlertDialogContent className="max-w-sm bg-white rounded-lg p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>Start Survey</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="text-gray-700">
            Are you ready to start filling out the survey? Once you begin, you
            can complete it at your own pace.
          </AlertDialogDescription>
          <AlertDialogFooter className="flex justify-end gap-3 mt-4">
            <MyButton
              buttonType="secondary"
              onClick={handleCloseSurveyConfirmDialog}
            >
              Cancel
            </MyButton>
            <MyButton buttonType="primary" onClick={handleSurveyConfirm}>
              Start Survey
            </MyButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
