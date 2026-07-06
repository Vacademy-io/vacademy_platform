import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MyButton } from "@/components/design-system/button";
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
import { useEffect, useState } from "react";
import { restartAssessment } from "../-utils.ts/useFetchRestartAssessment";
import {
  storeAssessmentInfo,
  fetchPreviewData,
} from "../-utils.ts/useFetchAssessment";
import { formatDuration } from "@/constants/helper";
import {
  formatCountdown,
  formatDate,
  formatDateTime,
} from "@/lib/format-date";
import { toast } from "sonner";
import { Timer, WarningCircle, HourglassMedium } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// Backend date strings (assessment list API) have no timezone marker but are
// stored in UTC. Appending "Z" makes Date() interpret them as UTC so the
// canonical formatters render them in the user's local timezone.
function toUtcDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const hasZone = /Z$|[+-]\d{2}:?\d{2}$/i.test(raw);
  const iso = hasZone ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Sentinel "never closes" end date used by the backend.
const NO_EXPIRY_YEAR = 9999;

function hasNoExpiry(end: Date | null): boolean {
  return !!end && end.getFullYear() === NO_EXPIRY_YEAR;
}

/** Re-render on an interval so countdown chips stay current. */
function useNow(enabled: boolean, intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);
  return now;
}

const PLAY_MODE_LABELS: Record<string, string> = {
  EXAM: "Exam",
  MOCK: "Mock",
  PRACTICE: "Practice",
  SURVEY: "Survey",
  MANUAL_UPLOAD_EXAM: "Offline exam",
};

const playModeLabel = (mode: string) => PLAY_MODE_LABELS[mode] ?? mode;

interface AssessmentProps {
  assessmentInfo: Assessment;
  assessmentType: assessmentTypes;
  assessment_types: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
  const handleCloseSurveyConfirmDialog = () =>
    setShowSurveyConfirmDialog(false);

  const handleSurveyConfirm = async () => {
    try {
      // fetchPreviewData surfaces its own error toast and resolves to undefined
      // on failure (it never throws), so only navigate when the preview loaded —
      // otherwise we'd drop the user into an empty LearnerLiveTest screen.
      const response = await fetchPreviewData(
        assessmentInfo.assessment_id,
        assessmentInfo.batch_id || assessmentInfo.package_session_id,
      );
      if (response) {
        navigate({
          to: `/assessment/examination/${assessmentInfo.assessment_id}/LearnerLiveTest`,
        });
      }
    } catch (error) {
      console.error("Error fetching survey data:", error);
      toast.error("Failed to start survey. Please try again.");
    }
    setShowSurveyConfirmDialog(false);
  };

  const handleAction = async () => {
    // If attempting to resume
    if (
      ["LIVE", "PREVIEW"].includes(assessmentInfo?.recent_attempt_status ?? "")
    ) {
      setShowRestartDialog(true);
      return;
    }

    // Check attempts logic
    const isEndedOrNull =
      assessmentInfo.recent_attempt_status === "ENDED" ||
      assessmentInfo.recent_attempt_status === null;

    if (isEndedOrNull) {
      const maxAttempts =
        assessmentInfo.user_attempts !== null && assessmentInfo.user_attempts !== 0
          ? assessmentInfo.user_attempts
          : (assessmentInfo.assessment_attempts ?? 1);
      const usedAttempts = assessmentInfo.created_attempts ?? 0;

      if (maxAttempts > usedAttempts) {
        // Await the write so InstructionID_and_AboutID is persisted before the
        // InstructionPage mounts and reads it — otherwise the first load reads
        // a null key and crashes (works only after a refresh).
        await storeAssessmentInfo(assessmentInfo);

        if (assessmentInfo.play_mode === "SURVEY") {
          setShowSurveyConfirmDialog(true);
        } else {
          navigate({
            to: `/assessment/examination/${assessmentInfo.assessment_id}`,
          });
        }
      } else {
        // Attempts exhausted, do nothing (button should be disabled anyway)
        return;
      }
    } else {
      // Normal start. Await the write (see note above) so the InstructionPage
      // never reads InstructionID_and_AboutID before it has been persisted.
      await storeAssessmentInfo(assessmentInfo);
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
        assessmentInfo.last_attempt_id ?? "",
      );

      if (isRestarted) {
        navigate({
          to: `/assessment/examination/${assessmentInfo.assessment_id}/LearnerLiveTest`,
          replace: true,
        });
      } else {
        toast.error(
          "Failed to resume the assessment. Assessment already Ended.",
        );
      }
    } catch (error) {
      console.error("Error in handleRestartAssessment:", error);
      toast.error("An error occurred while resuming the assessment.");
    } finally {
      setIsRestarting(false);
      setShowRestartDialog(false);
    }
  };

  const isResume = ["LIVE", "PREVIEW"].includes(
    assessmentInfo?.recent_attempt_status ?? "",
  );

  const attemptsExhausted = (() => {
    if (isResume) return false;
    const isEndedOrNull =
      assessmentInfo.recent_attempt_status === "ENDED" ||
      assessmentInfo.recent_attempt_status === null;
    if (!isEndedOrNull) return false;
    const maxAttempts =
      assessmentInfo.user_attempts !== null && assessmentInfo.user_attempts !== 0
        ? assessmentInfo.user_attempts
        : (assessmentInfo.assessment_attempts ?? 1);
    const usedAttempts = assessmentInfo.created_attempts ?? 0;
    return maxAttempts <= usedAttempts;
  })();

  // Determine button label
  const getButtonLabel = () => {
    if (isResume) return "Resume";
    if (attemptsExhausted) return "Ended";
    if (assessmentInfo.play_mode === "SURVEY") return "Start survey";
    if (["PRACTICE", "MOCK"].includes(assessmentInfo.play_mode)) return "Start";
    return "Join now";
  };

  const buttonLabel = getButtonLabel();
  const isButtonDisabled = () => attemptsExhausted;

  const isPractice = assessmentInfo.play_mode === "PRACTICE";
  const isMock = assessmentInfo.play_mode === "MOCK";
  const isLive = assessmentType === assessmentTypes.LIVE;
  const isUpcoming = assessmentType === assessmentTypes.UPCOMING;
  const isPast = assessmentType === assessmentTypes.PAST;
  // Loud "live" treatment only for scheduled modes; practice and mocks stay quiet.
  const isLoudLive = isLive && !isPractice && !isMock;

  const startDate = toUtcDate(assessmentInfo.bound_start_time);
  const endDate = toUtcDate(assessmentInfo.bound_end_time);
  const noExpiry = hasNoExpiry(endDate);

  const now = useNow((isLoudLive && !noExpiry) || isUpcoming);
  const msToClose = endDate ? endDate.getTime() - now : null;
  const msToStart = startDate ? startDate.getTime() - now : null;
  const showCloseCountdown =
    isLoudLive && !noExpiry && msToClose !== null && msToClose > 0;
  const showStartCountdown =
    isUpcoming && msToStart !== null && msToStart > 0 && msToStart < ONE_DAY_MS;

  const usedAttempts = assessmentInfo.created_attempts ?? 0;
  // Show the SAME max the exhaustion gate uses (per-user `user_attempts` when
  // set, else the assessment default). Previously this line always showed
  // `assessment_attempts`, so a card could read "Attempt 2 of 5" while the
  // button was disabled to "ENDED" because the real per-user limit was 2.
  const maxAttempts =
    assessmentInfo.user_attempts !== null && assessmentInfo.user_attempts !== 0
      ? assessmentInfo.user_attempts
      : (assessmentInfo.assessment_attempts ?? 0);

  const showPlayModeChip = assessment_types === "ASSESSMENT";

  // One quiet metadata line per card instead of a grid of colored info tiles.
  const metaParts: string[] = [];
  if (isUpcoming && startDate) {
    metaParts.push(`Starts ${formatDateTime(startDate)}`);
  }
  if (isLoudLive && !noExpiry && endDate) {
    metaParts.push(`Closes ${formatDateTime(endDate)}`);
  }
  if (isMock) {
    metaParts.push(
      noExpiry || !endDate
        ? "No expiry"
        : `Valid till ${formatDateTime(endDate)}`,
    );
  }
  if (assessmentInfo.duration && assessmentInfo.play_mode !== "SURVEY") {
    metaParts.push(formatDuration(assessmentInfo.duration * 60));
  }
  if (isLive && maxAttempts > 0) {
    metaParts.push(`Attempt ${usedAttempts} of ${maxAttempts}`);
  }

  const canShowReport =
    isPast &&
    usedAttempts > 0 &&
    (assessmentInfo.result_type !== "MANUAL" ||
      assessmentInfo.report_release_status === "RELEASED");
  const resultsPending =
    isPast &&
    usedAttempts > 0 &&
    assessmentInfo.result_type === "MANUAL" &&
    assessmentInfo.report_release_status !== "RELEASED";

  return (
    <>
      <Card
        className={cn(
          "w-full overflow-hidden transition-shadow duration-200",
          "[.ui-play_&]:rounded-play-card [.ui-play_&]:border-2 [.ui-play_&]:border-play-surface",
          isLoudLive
            ? cn(
                "border-danger-200 shadow-sm hover:shadow-md",
                "[.ui-play_&]:border-play-danger",
                "[.ui-vibrant_&]:border-t-4 [.ui-vibrant_&]:border-t-primary-300",
              )
            : "hover:shadow-sm",
          isPast && "shadow-none",
        )}
      >
        {/* ---------- PAST: collapsed row ---------- */}
        {isPast ? (
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <p className="line-clamp-1 text-body font-semibold text-foreground">
                {assessmentInfo.name}
              </p>
              <p className="mt-0.5 text-caption text-muted-foreground">
                {showPlayModeChip && `${playModeLabel(assessmentInfo.play_mode)} · `}
                {endDate && !noExpiry
                  ? `Ended ${formatDate(endDate)}`
                  : "Ended"}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              {canShowReport && (
                <>
                  <MyButton
                    buttonType="secondary"
                    scale="medium"
                    className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate({
                        to: `/assessment/reports/comparison`,
                        search: {
                          assessmentId: assessmentInfo.assessment_id,
                          attemptId: assessmentInfo.last_attempt_id ?? "",
                        },
                        state: {
                          assessmentName: assessmentInfo.name,
                        } as any,
                      });
                    }}
                  >
                    Show Report
                  </MyButton>
                  <MyButton
                    buttonType="secondary"
                    scale="medium"
                    className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate({
                        to: `/assessment/reports/ai-report`,
                        search: {
                          assessmentId: assessmentInfo.assessment_id,
                          assessmentName: assessmentInfo.name ?? "",
                        },
                      });
                    }}
                  >
                    Show AI Report
                  </MyButton>
                </>
              )}
              {resultsPending && (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-caption font-medium text-warning-700">
                  <HourglassMedium size={14} aria-hidden="true" />
                  Results pending
                </span>
              )}
            </div>
          </div>
        ) : (
          /* ---------- LIVE / UPCOMING / PRACTICE / MOCK ---------- */
          <div className="flex flex-col gap-3 p-4 sm:p-5">
            {(isLoudLive || showStartCountdown || showPlayModeChip) && (
            <div className="flex flex-wrap items-center gap-2">
              {isLoudLive && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-danger-200 bg-danger-50 px-2.5 py-0.5 text-caption font-semibold text-danger-600 [.ui-play_&]:border-transparent [.ui-play_&]:bg-play-danger [.ui-play_&]:font-black [.ui-play_&]:uppercase [.ui-play_&]:tracking-wide [.ui-play_&]:text-white">
                  <span className="relative flex size-2" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-400 opacity-75 [.ui-play_&]:bg-white/70" />
                    <span className="relative inline-flex size-2 rounded-full bg-danger-500 [.ui-play_&]:bg-white" />
                  </span>
                  Live now
                </span>
              )}
              {showCloseCountdown && msToClose !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2.5 py-0.5 text-caption font-medium tabular-nums text-danger-600">
                  <Timer size={14} aria-hidden="true" />
                  Closes in {formatCountdown(msToClose)}
                </span>
              )}
              {showStartCountdown && msToStart !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-caption font-medium tabular-nums text-primary-500 [.ui-play_&]:bg-play-highlight [.ui-play_&]:font-bold [.ui-play_&]:text-play-ink">
                  <Timer size={14} aria-hidden="true" />
                  Starts in {formatCountdown(msToStart)}
                </span>
              )}
              {showPlayModeChip && !isLoudLive && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-caption font-medium text-muted-foreground",
                    "[.ui-play_&]:border-2 [.ui-play_&]:border-play-surface [.ui-play_&]:bg-white [.ui-play_&]:font-bold [.ui-play_&]:text-play-ink",
                    isPractice &&
                      "[.ui-play_&]:border-transparent [.ui-play_&]:bg-play-highlight",
                  )}
                >
                  {playModeLabel(assessmentInfo.play_mode)}
                </span>
              )}
              {showPlayModeChip && isLoudLive && (
                <span
                  className={cn(
                    "ml-auto inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-caption font-medium text-muted-foreground",
                    "[.ui-play_&]:border-2 [.ui-play_&]:border-play-surface [.ui-play_&]:bg-white [.ui-play_&]:font-bold [.ui-play_&]:text-play-ink",
                  )}
                >
                  {playModeLabel(assessmentInfo.play_mode)}
                </span>
              )}
            </div>
            )}

            <div className="min-w-0">
              <h3
                className={cn(
                  "line-clamp-2 font-semibold leading-snug text-foreground",
                  isLoudLive ? "text-title" : "text-subtitle",
                )}
              >
                {assessmentInfo.name}
              </h3>
              {metaParts.length > 0 && (
                <p className="mt-1 text-caption text-muted-foreground">
                  {metaParts.join(" · ")}
                </p>
              )}
            </div>

            {isLive && (
              <MyButton
                buttonType={isLoudLive ? "primary" : "secondary"}
                scale="medium"
                disable={isButtonDisabled()}
                className={cn(
                  "min-h-11 w-full font-semibold sm:w-auto sm:self-end",
                  // Play mode: the live Join CTA SHOUTS — press grammar on danger.
                  isLoudLive &&
                    !attemptsExhausted &&
                    cn(
                      "[.ui-play_&]:min-h-12 [.ui-play_&]:rounded-play-card [.ui-play_&]:border-0",
                      "[.ui-play_&]:bg-play-danger [.ui-play_&]:hover:bg-play-danger",
                      "[.ui-play_&]:text-body [.ui-play_&]:font-black [.ui-play_&]:uppercase [.ui-play_&]:tracking-wide [.ui-play_&]:text-white",
                      "[.ui-play_&]:shadow-play-2d-danger [.ui-play_&]:active:translate-y-0.5 [.ui-play_&]:active:shadow-none",
                    ),
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction();
                }}
              >
                {buttonLabel}
              </MyButton>
            )}
          </div>
        )}
      </Card>

      {/* Pop-up for Upcoming Tests */}
      <Dialog open={showPopup} onOpenChange={handleClosePopup}>
        <DialogContent className="max-w-sm rounded-lg p-6">
          <DialogHeader>
            <div className="mb-2 flex items-center gap-2">
              <div className="rounded-full bg-warning-50 p-2">
                <WarningCircle className="size-5 text-warning-600" />
              </div>
              <DialogTitle className="text-lg font-semibold">
                Assessment Unavailable
              </DialogTitle>
            </div>
            <DialogDescription className="pt-1 text-muted-foreground">
              The assessment is not live currently. You can appear for the
              assessment when it goes live.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Resume Confirmation Dialog */}
      <AlertDialog
        open={showRestartDialog}
        onOpenChange={handleCloseRestartDialog}
      >
        <AlertDialogContent className="max-w-sm rounded-lg p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">
              Resume Assessment
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Would you like to continue the assessment from your last saved
              progress?
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
      <AlertDialog
        open={showSurveyConfirmDialog}
        onOpenChange={handleCloseSurveyConfirmDialog}
      >
        <AlertDialogContent className="max-w-sm rounded-lg p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">
              Start Survey
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you ready to start filling out the survey? Once you begin, you
              can complete it at your own pace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-3 sm:gap-2">
            <Button variant="ghost" onClick={handleCloseSurveyConfirmDialog}>
              Cancel
            </Button>
            <Button onClick={handleSurveyConfirm}>Start Survey</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
