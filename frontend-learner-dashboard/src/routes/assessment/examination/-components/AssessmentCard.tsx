import { Card } from "@/components/ui/card";
import { useNavigate } from "@tanstack/react-router";
import { MyButton } from "@/components/design-system/button";
import { PlayMode, StatusChip } from "@/components/design-system/chips";
import { assessmentTypes } from "@/types/assessment";
import { Assessment } from "@/types/assessment";
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
import { storeAssessmentInfo } from "../-utils.ts/useFetchAssessment";
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
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showPopup) {
      timer = setTimeout(() => {
        setShowPopup(false);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [showPopup]);

  const handleClosePopup = () => setShowPopup(false);
  const handleCloseRestartDialog = () => setShowRestartDialog(false);

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
          : (assessmentInfo.assessment_attempts ?? 1);
      const total_given_attempts = assessmentInfo.created_attempts ?? 0;

      if ((max_posible_attempts ?? 1) > total_given_attempts) {
        storeAssessmentInfo(assessmentInfo);
        navigate({
          to: `/assessment/examination/${assessmentInfo.assessment_id}`,
        });
      } else {
        return;
      }
    } else {
      storeAssessmentInfo(assessmentInfo);
      navigate({
        to: `/assessment/examination/${assessmentInfo.assessment_id}`,
      });
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
          : (assessmentInfo.assessment_attempts ?? 1);
      const total_given_attempts = assessmentInfo.created_attempts ?? 0;
      
      if ((max_posible_attempts ?? 1) > total_given_attempts) {
        return "Join Assessment";
      } else {
        return "Ended";
      }
    }
    return "Join Assessment";
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
      <Card className="w-full p-6 space-y-6" onClick={handleOpen}>
        <h2 className="text-sm lg:text-base font-semibold">
          {assessmentInfo.name}
        </h2>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            {assessment_types == "ASSESSMENT" && (
              <div className="flex gap-3 pb-3 items-center">
                <StatusChip
                  playMode={assessmentInfo.play_mode as PlayMode}
                  className={
                    playModeColors[assessmentInfo.play_mode as PlayMode]
                  }
                />
              </div>
            )}
            {assessmentInfo.play_mode !== "PRACTICE" && (
              <div className="space-y-2 text-xs lg:text-sm text-gray-600">
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
                {assessmentInfo.duration && (
                  <div>
                    Duration: {formatDuration(assessmentInfo.duration * 60)}
                  </div>
                )}
                <div>
                  Attempts: {assessmentInfo.created_attempts ?? 0} /{" "}
                  {assessmentInfo.user_attempts !== 0 &&
                  assessmentInfo.user_attempts !== null
                    ? assessmentInfo.user_attempts
                    : (assessmentInfo.assessment_attempts ?? 0)}
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
                  disabled={assessmentInfo.recent_attempt_status === "ENDED"}
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
                  className="w-full max-w-xs md:w-[200px] lg:w-[300px]"
                  onClick={() =>
                    navigate({
                      to: `/assessment/reports/student-report`,
                      search: {
                        assessmentId: assessmentInfo.assessment_id,
                        attemptId: assessmentInfo.last_attempt_id ?? "",
                      },
                      // state: { report } as any,
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
      <AlertDialog open={showPopup} onOpenChange={handleClosePopup}>
        <AlertDialogOverlay
          className="bg-black/50"
          onClick={handleClosePopup}
        />
        <AlertDialogContent className="max-w-sm bg-[#FDFAF6] rounded-lg p-4 sm:mx-4 sm:p-6">
          <div className="text-gray-700">
            The assessment{" "}
            <span className="text-primary-500">{assessmentInfo.name}</span> is
            not live currently. You can appear for the assessment when it goes
            live.
          </div>
        </AlertDialogContent>
      </AlertDialog>

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
    </>
  );
};
