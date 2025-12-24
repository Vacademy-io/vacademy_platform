import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { assessmentTypes, Assessment } from "@/types/assessment";
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
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import dayjs from "dayjs";
import { restartAssessment } from "../-utils.ts/useFetchRestartAssessment";
import {
  storeAssessmentInfo,
  fetchPreviewData,
} from "../-utils.ts/useFetchAssessment";
import { formatDuration } from "@/constants/helper";
import { toast } from "sonner";
import { CalendarDays, Timer, RotateCw, Clock, Eye, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssessmentProps {
  assessmentInfo: Assessment;
  assessmentType: assessmentTypes;
  assessment_types: string;
}

// Map play modes to semantic colors/styles
const getPlayModeStyles = (mode: string) => {
  switch (mode) {
    case "EXAM":
      return "bg-green-100 text-green-700 border-green-200 hover:bg-green-200/80";
    case "MOCK":
      return "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200/80";
    case "PRACTICE":
      return "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200/80";
    case "SURVEY":
      return "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200/80";
    default:
      return "bg-muted text-muted-foreground border-border hover:bg-muted/80";
  }
};

const getCardBorderColor = (mode: string) => {
  switch (mode) {
    case "EXAM":
      return "border-l-green-500";
    case "MOCK":
      return "border-l-purple-500";
    case "PRACTICE":
      return "border-l-blue-500";
    case "SURVEY":
      return "border-l-rose-500";
    default:
      return "border-l-border";
  }
}

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

  // Helper to safely close dialogs
  const handleClosePopup = () => setShowPopup(false);
  const handleCloseRestartDialog = () => setShowRestartDialog(false);
  const handleCloseSurveyConfirmDialog = () => setShowSurveyConfirmDialog(false);

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

  const handleAction = async () => {
    // If attempting to resume
    if (["LIVE", "PREVIEW"].includes(assessmentInfo?.recent_attempt_status ?? "")) {
      setShowRestartDialog(true);
      return;
    }

    // Check attempts logic
    const isEndedOrNull = assessmentInfo.recent_attempt_status === "ENDED" || assessmentInfo.recent_attempt_status === null;

    if (isEndedOrNull) {
      const maxAttempts = assessmentInfo.user_attempts !== 0
        ? assessmentInfo.user_attempts
        : (assessmentInfo.assessment_attempts ?? 1);
      const usedAttempts = assessmentInfo.created_attempts ?? 0;

      if ((maxAttempts ?? 1) > usedAttempts) {
        storeAssessmentInfo(assessmentInfo);

        if (assessmentInfo.play_mode === "SURVEY") {
          setShowSurveyConfirmDialog(true);
        } else {
          navigate({ to: `/assessment/examination/${assessmentInfo.assessment_id}` });
        }
      } else {
        // Attempts exhausted, do nothing (button should be disabled anyway)
        return;
      }
    } else {
      // Normal start
      storeAssessmentInfo(assessmentInfo);
      if (assessmentInfo.play_mode === "SURVEY") {
        setShowSurveyConfirmDialog(true);
      } else {
        navigate({ to: `/assessment/examination/${assessmentInfo.assessment_id}` });
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

      if (isRestarted) {
        navigate({
          to: `/assessment/examination/${assessmentInfo.assessment_id}/LearnerLiveTest`,
          replace: true,
        });
      } else {
        toast.error("Failed to resume the assessment. Assessment already Ended.");
      }
    } catch (error) {
      console.error("Error in handleRestartAssessment:", error);
      toast.error("An error occurred while resuming the assessment.");
    } finally {
      setIsRestarting(false);
      setShowRestartDialog(false);
    }
  };

  // Determine button label
  const getButtonLabel = () => {
    if (["LIVE", "PREVIEW"].includes(assessmentInfo?.recent_attempt_status ?? "")) {
      return "Resume";
    }

    const isEndedOrNull = assessmentInfo.recent_attempt_status === "ENDED" || assessmentInfo.recent_attempt_status === null;
    if (isEndedOrNull) {
      const maxAttempts = assessmentInfo.user_attempts !== 0
        ? assessmentInfo.user_attempts
        : (assessmentInfo.assessment_attempts ?? 1);
      const usedAttempts = assessmentInfo.created_attempts ?? 0;

      if ((maxAttempts ?? 1) > usedAttempts) {
        return "Join Assessment";
      } else {
        return "Ended";
      }
    }
    return "Join Assessment";
  };

  const isButtonDisabled = () => {
    return getButtonLabel() === "Ended";
  };

  const buttonLabel = getButtonLabel();
  const isResume = ["LIVE", "PREVIEW"].includes(assessmentInfo?.recent_attempt_status ?? "");

  return (
    <>
      <Card
        className={cn(
          "w-full transition-all duration-200 border-l-[6px] overflow-hidden hover:shadow-md cursor-default",
          getCardBorderColor(assessmentInfo.play_mode)
        )}
      >
        <CardHeader className="pb-3 pt-5 px-5 sm:px-6">
          <div className="flex justify-between items-start gap-4">
            <div className="flex flex-col gap-2">
              {assessment_types === "ASSESSMENT" && (
                <div className="flex">
                  <Badge variant="outline" className={cn("px-2.5 py-0.5 text-xs font-semibold tracking-wider border", getPlayModeStyles(assessmentInfo.play_mode))}>
                    {assessmentInfo.play_mode}
                  </Badge>
                </div>
              )}
              <CardTitle className="text-lg sm:text-xl font-bold leading-snug line-clamp-2 text-foreground">
                {assessmentInfo.name}
              </CardTitle>
            </div>
          </div>
        </CardHeader>

        <Separator className="opacity-50" />

        <CardContent className="pt-5 pb-5 px-5 sm:px-6">
          {assessmentInfo.play_mode !== "PRACTICE" && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-4">
              {/* Start Time */}
              {assessmentInfo.play_mode !== "MOCK" && (
                <InfoItem
                  icon={<CalendarDays className="w-4 h-4 text-blue-600" />}
                  bgClass="bg-blue-50"
                  label="Starts"
                  value={dayjs(assessmentInfo.bound_start_time).format("DD MMM, hh:mm A")}
                />
              )}

              {/* End Time */}
              <InfoItem
                icon={<Clock className="w-4 h-4 text-purple-600" />}
                bgClass="bg-purple-50"
                label={assessmentInfo.play_mode === "MOCK" ? "Valid Till" : "Ends"}
                value={
                  dayjs(assessmentInfo.bound_end_time).year() === 9999
                    ? "No Expiry"
                    : dayjs(assessmentInfo.bound_end_time).format("DD MMM, hh:mm A")
                }
              />

              {/* Duration */}
              {assessmentInfo.duration && assessmentInfo.play_mode !== "SURVEY" && (
                <InfoItem
                  icon={<Timer className="w-4 h-4 text-orange-600" />}
                  bgClass="bg-orange-50"
                  label="Duration"
                  value={formatDuration(assessmentInfo.duration * 60)}
                />
              )}

              {/* Preview Time */}
              {assessmentInfo.preview_time > 0 && (
                <InfoItem
                  icon={<Eye className="w-4 h-4 text-teal-600" />}
                  bgClass="bg-teal-50"
                  label="Preview"
                  value={formatDuration(assessmentInfo.preview_time * 60)}
                />
              )}

              {/* Attempts */}
              <InfoItem
                icon={<RotateCw className="w-4 h-4 text-green-600" />}
                bgClass="bg-green-50"
                label="Attempts"
                value={`${assessmentInfo.created_attempts ?? 0} / ${assessmentInfo.user_attempts !== 0 && assessmentInfo.user_attempts !== null
                  ? assessmentInfo.user_attempts
                  : (assessmentInfo.assessment_attempts ?? 0)
                  }`}
              />
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-muted/30 py-4 px-5 sm:px-6 flex justify-end gap-3 border-t">
          {assessmentType !== assessmentTypes.UPCOMING && assessmentType !== assessmentTypes.PAST && (
            <Button
              className={cn("w-full sm:w-auto min-w-[140px] font-semibold transition-all")}
              variant={isResume ? "default" : (buttonLabel === "Ended" ? "secondary" : "default")}
              disabled={isButtonDisabled()}
              onClick={(e) => {
                e.stopPropagation();
                handleAction();
              }}
            >
              {buttonLabel}
            </Button>
          )}

          {/* upcoming state button (disabled or specific action) */}
          {assessmentType === assessmentTypes.UPCOMING && (
            <Button variant="outline" className="w-full sm:w-auto min-w-[140px] cursor-not-allowed text-muted-foreground" disabled>
              Upcoming
            </Button>
          )}

          {assessmentType === assessmentTypes.PAST && (assessmentInfo.created_attempts ?? 0) > 0 && (
            <Button
              variant="outline"
              className="w-full sm:w-auto min-w-[140px] text-primary hover:text-primary hover:bg-primary/5"
              onClick={(e) => {
                e.stopPropagation();
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
              }}
            >
              Show Report
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Pop-up for Upcoming Tests */}
      <Dialog open={showPopup} onOpenChange={handleClosePopup}>
        <DialogContent className="max-w-sm rounded-lg p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-yellow-100 rounded-full">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <DialogTitle className="text-lg font-semibold">Assessment Unavailable</DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground pt-1">
              The assessment is not live currently. You can appear for the assessment when it goes live.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Resume Confirmation Dialog */}
      <AlertDialog open={showRestartDialog} onOpenChange={handleCloseRestartDialog}>
        <AlertDialogContent className="max-w-sm rounded-lg p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Resume Assessment</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Would you like to continue the assessment from your last saved progress?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-3 sm:gap-2">
            <Button variant="ghost" onClick={handleCloseRestartDialog}>
              Cancel
            </Button>
            <Button onClick={handleRestartAssessment} disabled={isRestarting}>
              {isRestarting ? "Resuming..." : "Resume"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Survey Confirmation Dialog */}
      <AlertDialog open={showSurveyConfirmDialog} onOpenChange={handleCloseSurveyConfirmDialog}>
        <AlertDialogContent className="max-w-sm rounded-lg p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Start Survey</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you ready to start filling out the survey? Once you begin, you can complete it at your own pace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-3 sm:gap-2">
            <Button variant="ghost" onClick={handleCloseSurveyConfirmDialog}>
              Cancel
            </Button>
            <Button onClick={handleSurveyConfirm}>
              Start Survey
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// Reusable Sub-component for Info Items
const InfoItem = ({
  icon,
  bgClass,
  label,
  value,
}: {
  icon: React.ReactNode;
  bgClass: string;
  label: string;
  value: string | number;
}) => {
  return (
    <div className="flex items-start gap-3">
      <div className={cn("p-2 rounded-lg shrink-0", bgClass)}>{icon}</div>
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className="text-sm font-medium text-foreground leading-tight mt-0.5">
          {value}
        </span>
      </div>
    </div>
  );
};
