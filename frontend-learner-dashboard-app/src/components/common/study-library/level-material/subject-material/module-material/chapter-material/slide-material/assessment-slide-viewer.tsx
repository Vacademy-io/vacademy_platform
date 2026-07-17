import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Storage } from "@/utils/storage-plugin";
import {
  CheckCircle,
  Clock,
  Eye,
  FileArrowDown,
  ListChecks,
  ListNumbers,
  PlayCircle,
  ArrowClockwise,
  Trophy,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EvaluatedReportDialog } from "@/components/common/student-test-records/evaluated-report-dialog";
import { Slide } from "@/hooks/study-library/use-slides";
import { fetchAssessmentData, storeAssessmentInfo } from "@/routes/assessment/examination/-utils.ts/useFetchAssessment";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { Assessment, assessmentTypes } from "@/types/assessment";
import { formatDuration, getInstituteId } from "@/constants/helper";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { GET_ASSESSMENT_MARKS, STUDENT_REPORT_DETAIL_URL } from "@/constants/urls";
import { getFileDetail } from "@/services/upload_file";

interface TotalMarksResponse {
  total_achievable_marks?: number | null;
  section_wise_achievable_marks?: Record<string, number> | null;
}

interface ReportDetailResponse {
  evaluated_file_id?: string | null;
  question_overall_detail_dto?: {
    achievedMarks?: number | null;
  } | null;
  all_sections?: Record<
    string,
    Array<{ evaluator_feedback?: string | null }>
  > | null;
}

const SLIDE_RETURN_KEY = "SLIDE_RETURN_CONTEXT";

export interface SlideReturnContext {
  returnSlideId: string;
  returnPathname: string;
  returnSearch: string; // serialized URLSearchParams (without leading "?")
  startedAt: number;
}

const stashReturnContext = async (slideId: string) => {
  const search = new URLSearchParams(window.location.search);
  // Drop any prior return-context noise from the URL so we don't snowball.
  search.delete("justSubmittedAssessment");
  const ctx: SlideReturnContext = {
    returnSlideId: slideId,
    returnPathname: window.location.pathname,
    returnSearch: search.toString(),
    startedAt: Date.now(),
  };
  // sessionStorage is the primary read site (web), Capacitor Storage is the
  // mobile-safe fallback. Writing both keeps the contract simple — submit
  // path reads sessionStorage first.
  try {
    sessionStorage.setItem(SLIDE_RETURN_KEY, JSON.stringify(ctx));
  } catch {
    // ignore — fallback handles it
  }
  try {
    await Storage.set({ key: SLIDE_RETURN_KEY, value: JSON.stringify(ctx) });
  } catch {
    // best effort
  }
};

interface InfoChipProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | null | undefined;
  bgClass?: string;
}

const InfoChip = ({ icon, label, value, bgClass }: InfoChipProps) => (
  <div className="flex items-center gap-2 rounded-md bg-white border border-neutral-200 px-3 py-2">
    <div className={`flex size-7 items-center justify-center rounded ${bgClass || "bg-primary-50"}`}>
      {icon}
    </div>
    <div className="flex flex-col">
      <span className="text-2xs uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="text-sm font-semibold text-neutral-800">{value ?? "—"}</span>
    </div>
  </div>
);

interface AssessmentSlideViewerProps {
  activeItem: Slide;
}

const fetchAcrossBuckets = async (assessmentId: string): Promise<Assessment | null> => {
  // Pull from each bucket in turn until we find a match. Each bucket is a
  // separate paginated list; checking all three covers any state the
  // assessment may currently be in for this learner.
  const buckets: assessmentTypes[] = [
    assessmentTypes.LIVE,
    assessmentTypes.UPCOMING,
    assessmentTypes.PAST,
  ];
  for (const bucket of buckets) {
    try {
      const response = await fetchAssessmentData(0, 50, bucket, "ASSESSMENT");
      const content = (response?.content ?? []) as Assessment[];
      const match = content.find((a) => a.assessment_id === assessmentId);
      if (match) return match;
    } catch {
      // try next bucket
    }
  }
  return null;
};

const AssessmentSlideViewer = ({ activeItem }: AssessmentSlideViewerProps) => {
  const navigate = useNavigate();
  // package_session_id of the course this slide is being viewed in — the batch
  // the learner is enrolled in for this assessment.
  const currentPackageSessionId = useContentStore(
    (state) => state.currentPackageSessionId
  );
  const assessmentSlide = activeItem.assessment_slide;
  const assessmentId = assessmentSlide?.assessment_id;

  const { data: assessment, isLoading, isError } = useQuery({
    queryKey: ["ASSESSMENT_SLIDE_VIEWER", assessmentId, activeItem.id],
    queryFn: () => fetchAcrossBuckets(assessmentId!),
    enabled: Boolean(assessmentId),
    staleTime: 30 * 1000,
  });

  const { data: totalMarksData } = useQuery<TotalMarksResponse>({
    queryKey: ["ASSESSMENT_SLIDE_TOTAL_MARKS_LEARNER", assessmentId],
    queryFn: async () => {
      const response = await authenticatedAxiosInstance({
        method: "GET",
        url: GET_ASSESSMENT_MARKS,
        params: { assessmentId },
      });
      return response?.data;
    },
    enabled: Boolean(assessmentId),
    staleTime: 30 * 1000,
  });

  const sectionCount = totalMarksData?.section_wise_achievable_marks
    ? Object.keys(totalMarksData.section_wise_achievable_marks).length
    : null;

  const allowReattempt = assessmentSlide?.allow_reattempt !== false;
  const showResult = assessmentSlide?.show_result !== false;

  const status = assessment?.recent_attempt_status ?? null;
  const isInProgress = status === "LIVE" || status === "PREVIEW";
  const isSubmitted = status === "ENDED";

  const maxAttempts = useMemo(() => {
    if (!assessment) return null;
    return assessment.user_attempts && assessment.user_attempts > 0
      ? assessment.user_attempts
      : assessment.assessment_attempts ?? 1;
  }, [assessment]);

  const usedAttempts = assessment?.created_attempts ?? 0;
  const attemptsLeft = maxAttempts !== null ? Math.max(0, maxAttempts - usedAttempts) : null;
  const canStartFresh = attemptsLeft === null ? false : attemptsLeft > 0;
  const canReattempt = isSubmitted && allowReattempt && canStartFresh;

  const buttonState = (() => {
    if (!assessment) return { label: "Start Assessment", disabled: true, icon: PlayCircle };
    if (isInProgress) return { label: "Resume Assessment", disabled: false, icon: ArrowClockwise };
    if (isSubmitted) {
      if (canReattempt) return { label: "Re-attempt", disabled: false, icon: ArrowClockwise };
      return { label: "Submitted", disabled: true, icon: CheckCircle };
    }
    if (canStartFresh) return { label: "Start Assessment", disabled: false, icon: PlayCircle };
    return { label: "Not Available", disabled: true, icon: PlayCircle };
  })();

  const handleStart = async () => {
    if (!assessment || buttonState.disabled) return;
    try {
      await stashReturnContext(activeItem.id);
      // The assessment object pulled from the learner's lists may not carry a
      // batch_id/package_session_id (e.g. open/public or root-user contexts).
      // Without one, the downstream assessment-start-preview call sends an empty
      // batch_ids and the backend rejects it with "batch id not found". The
      // slide is always viewed inside a specific course/batch, so stamp that
      // batch (currentPackageSessionId) onto the stored assessment so
      // StartAssessment -> fetchPreviewData resolves the correct batch.
      const slideBatchId =
        currentPackageSessionId ||
        assessment.batch_id ||
        assessment.package_session_id;
      await storeAssessmentInfo({
        ...assessment,
        batch_id: slideBatchId,
        package_session_id: slideBatchId,
      });
      navigate({
        to: `/assessment/examination/${assessment.assessment_id}`,
      });
    } catch (err) {
      console.error("Failed to start assessment from slide", err);
      toast.error("Could not start the assessment. Please try again.");
    }
  };

  // Show a report link once submitted, results are enabled for this slide, and
  // the admin has released them. Uses the learner's latest attempt id.
  const canViewReport =
    isSubmitted &&
    showResult &&
    assessment?.report_release_status === "RELEASED" &&
    Boolean(assessment?.last_attempt_id);

  const handleViewReport = () => {
    if (!assessment?.last_attempt_id) return;
    // Open the new comparison report. Slide assessments are always MANUAL, so the
    // comparison view hides the Answer Review (no per-question learner responses).
    navigate({
      to: "/assessment/reports/comparison",
      search: {
        assessmentId: assessment.assessment_id,
        attemptId: assessment.last_attempt_id,
      },
      state: {
        assessmentName: assessment.name,
        evaluationType: "MANUAL",
      } as any,
    });
  };

  // Once results are viewable, pull the attempt's report detail so we can show
  // the achieved score (and, for manual assessments, the evaluated copy) right
  // here — instead of making the learner open the full report just to see it.
  const { data: reportDetail } = useQuery<ReportDetailResponse | null>({
    queryKey: [
      "ASSESSMENT_SLIDE_REPORT_DETAIL",
      assessmentId,
      assessment?.last_attempt_id,
    ],
    queryFn: async () => {
      const instituteId = await getInstituteId();
      const response = await authenticatedAxiosInstance({
        method: "GET",
        url: STUDENT_REPORT_DETAIL_URL,
        params: {
          assessmentId,
          attemptId: assessment?.last_attempt_id,
          instituteId,
        },
      });
      return response?.data ?? null;
    },
    enabled: canViewReport,
    staleTime: 60 * 1000,
  });

  const achievedMarks = reportDetail?.question_overall_detail_dto?.achievedMarks;
  const evaluatedFileId = reportDetail?.evaluated_file_id;

  // The teacher's remark rides on the question's evaluator_feedback.
  const evaluatorRemark = (() => {
    const sections = reportDetail?.all_sections;
    if (!sections) return null;
    for (const questions of Object.values(sections)) {
      const found = Array.isArray(questions)
        ? questions.find((q) => q?.evaluator_feedback)
        : null;
      if (found?.evaluator_feedback) return found.evaluator_feedback;
    }
    return null;
  })();

  // Render the evaluated copy in the shared in-app viewer rather than
  // window.open — the signed S3 URL has no extension, so the native webview
  // can't open it on its own (and a download would save an extension-less,
  // un-openable file). The copy may be a PDF or an image, so we resolve its
  // real name + type and render/download it in that format.
  const [evaluatedUrl, setEvaluatedUrl] = useState<string | null>(null);
  const [evaluatedName, setEvaluatedName] = useState<string | undefined>(
    undefined
  );
  const [evaluatedType, setEvaluatedType] = useState<string | undefined>(
    undefined
  );
  const [evaluatedOpen, setEvaluatedOpen] = useState(false);
  const [openingEvaluated, setOpeningEvaluated] = useState(false);

  const handleViewEvaluatedCopy = async () => {
    if (!evaluatedFileId || openingEvaluated) return;
    try {
      setOpeningEvaluated(true);
      const detail = await getFileDetail(evaluatedFileId);
      if (detail?.url) {
        setEvaluatedUrl(detail.url);
        setEvaluatedName(
          detail.fileName || `${assessment?.name || "assessment"} - evaluated`
        );
        setEvaluatedType(detail.fileType);
        setEvaluatedOpen(true);
      } else {
        toast.error("Could not open the evaluated copy.");
      }
    } catch {
      toast.error("Could not open the evaluated copy.");
    } finally {
      setOpeningEvaluated(false);
    }
  };

  if (!assessmentId) {
    return (
      <div className="flex h-reg-420 flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50">
        <ListChecks className="size-8 text-neutral-400" />
        <p className="mt-3 text-sm text-neutral-500">No assessment is linked to this slide.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-rose-50 p-2.5 text-rose-500">
            <ListChecks className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xs uppercase tracking-wide text-neutral-500">
              Assessment
            </span>
            <h2 className="text-xl font-semibold leading-snug text-neutral-900">
              {isLoading
                ? "Loading assessment…"
                : assessment?.name || activeItem.title || "Assessment"}
            </h2>
          </div>
        </div>
        {assessment?.play_mode && (
          <Badge variant="outline" className="px-2 py-0.5 text-2xs uppercase tracking-wider">
            {assessment.play_mode}
          </Badge>
        )}
      </div>

      {isError && !assessment && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          Could not load assessment details. You may not have access to this assessment yet.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <InfoChip
          icon={<Clock className="size-4 text-orange-600" />}
          label="Duration"
          bgClass="bg-orange-50"
          value={
            assessment?.duration && assessment.duration > 0
              ? formatDuration(assessment.duration * 60)
              : null
          }
        />
        <InfoChip
          icon={<ListNumbers className="size-4 text-blue-600" />}
          label="Sections"
          bgClass="bg-blue-50"
          value={sectionCount && sectionCount > 0 ? sectionCount : null}
        />
        <InfoChip
          icon={<Trophy className="size-4 text-amber-600" />}
          label="Total marks"
          bgClass="bg-amber-50"
          value={
            typeof totalMarksData?.total_achievable_marks === "number"
              ? totalMarksData.total_achievable_marks
              : null
          }
        />
      </div>

      {/* Status banner */}
      {isSubmitted && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle className="size-5" />
            <span className="text-sm font-semibold">You have submitted this assessment.</span>
          </div>
          {!showResult ? (
            <p className="mt-1 text-xs text-emerald-700/80">
              Results are not shown for this assessment.
            </p>
          ) : assessment?.report_release_status === "RELEASED" ? (
            <div className="mt-2 flex flex-col gap-2">
              {typeof achievedMarks === "number" ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-emerald-700">
                    {achievedMarks}
                  </span>
                  {typeof totalMarksData?.total_achievable_marks === "number" && (
                    <span className="text-sm font-medium text-emerald-700/70">
                      / {totalMarksData.total_achievable_marks}
                    </span>
                  )}
                  <span className="text-2xs uppercase tracking-wide text-emerald-700/60">
                    marks
                  </span>
                </div>
              ) : (
                <p className="text-xs text-emerald-700/80">
                  Your result is available — open the report for details.
                </p>
              )}
              {evaluatorRemark && (
                <div className="rounded-md border border-emerald-200 bg-white/70 p-2.5">
                  <p className="text-2xs font-semibold uppercase tracking-wide text-emerald-700/70">
                    Evaluator remark
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-emerald-900">
                    {evaluatorRemark}
                  </p>
                </div>
              )}
              {evaluatedFileId && (
                <Button
                  variant="link"
                  onClick={handleViewEvaluatedCopy}
                  disabled={openingEvaluated}
                  className="h-auto w-fit gap-1.5 p-0 text-xs font-medium text-emerald-700"
                >
                  <FileArrowDown className="size-4" />
                  {openingEvaluated ? "Opening…" : "View evaluated copy"}
                </Button>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-emerald-700/80">
              Your submission is being evaluated. Results will appear once released.
            </p>
          )}
        </div>
      )}

      {isInProgress && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          You have an attempt in progress. Resume to continue where you left off.
        </div>
      )}

      <div className="mt-1 flex items-center justify-end gap-2">
        {canViewReport && (
          <Button
            size="lg"
            variant="outline"
            onClick={handleViewReport}
            className="min-w-reg-180"
          >
            <Eye className="me-2 size-4" />
            View Report
          </Button>
        )}
        <Button
          size="lg"
          disabled={buttonState.disabled}
          onClick={handleStart}
          className="min-w-reg-180"
        >
          <buttonState.icon className="me-2 size-4" />
          {buttonState.label}
        </Button>
      </div>

      <EvaluatedReportDialog
        open={evaluatedOpen}
        onOpenChange={setEvaluatedOpen}
        fileUrl={evaluatedUrl}
        fileName={evaluatedName}
        fileType={evaluatedType}
        remark={evaluatorRemark}
        title="Evaluated copy"
      />
    </div>
  );
};

export default AssessmentSlideViewer;
export { SLIDE_RETURN_KEY };
