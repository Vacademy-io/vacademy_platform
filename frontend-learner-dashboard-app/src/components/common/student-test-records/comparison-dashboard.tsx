import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PdfDownloadButton } from "./pdf-download-button";
import { EvaluatedReportDialog } from "./evaluated-report-dialog";
import { AnnotatedCopyDialog } from "./annotated-copy-dialog";
import { MarksDistributionChart } from "./marks-distribution-chart";
import { SectionComparisonTable } from "./section-comparison-table";
import { MarksStatusIndicator } from "./marks-chip";
import { formatDuration } from "@/constants/helper";
import { parseHtmlToString } from "@/lib/utils";
import { useState, useCallback, useEffect } from "react";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { getFileDetail } from "@/services/upload_file";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  STUDENT_REPORT_DETAIL_URL,
  GET_QUESTIONS_OF_SECTIONS,
  GET_ASSESSMENT_DETAILS,
  LEARNER_OPTION_DISTRIBUTION_URL,
  EXPORT_ASSESSMENT_REPORT,
} from "@/constants/urls";
import {
  renderStudentResponse,
  renderCorrectAnswer,
  type SectionQuestions,
} from "./question-response-renderer";
import {
  ChartBar,
  ChartLineUp,
  Clock,
  ListChecks,
  Target,
  Timer,
  Trophy,
  DotsThreeVertical,
  DownloadSimple,
  Eye,
  FileArrowDown,
  Sparkle,
} from "@phosphor-icons/react";
import { formatDateTime, formatTime } from "@/lib/format-date";
import { EmptyState } from "@/components/design-system/states";
import { cn } from "@/lib/utils";
import { playIllustrations } from "@/assets/play-illustrations";

// Verdict thresholds mirror getPerformanceLevel in test-report-dialog.tsx.
// Play-mode variants restate the verdict in play status tokens
// (success / warn / danger) on top of the default semantic chips.
function getVerdict(pct: number): {
  label: string;
  className: string;
} {
  if (pct >= 90)
    return {
      label: "Excellent",
      className:
        "border-success-200 bg-success-50 text-success-700 [.ui-play_&]:border-transparent [.ui-play_&]:bg-play-success-soft [.ui-play_&]:font-black [.ui-play_&]:text-play-success-soft-ink",
    };
  if (pct >= 60)
    return {
      label: "Good",
      className:
        "border-success-200 bg-success-50 text-success-700 [.ui-play_&]:border-transparent [.ui-play_&]:bg-play-success-soft [.ui-play_&]:font-black [.ui-play_&]:text-play-success-soft-ink",
    };
  if (pct >= 50)
    return {
      label: "Average",
      className:
        "border-warning-200 bg-warning-50 text-warning-700 [.ui-play_&]:border-transparent [.ui-play_&]:bg-play-warn [.ui-play_&]:font-black [.ui-play_&]:text-play-ink",
    };
  return {
    label: "Low",
    className:
      "border-danger-200 bg-danger-50 text-danger-700 [.ui-play_&]:border-transparent [.ui-play_&]:bg-play-danger [.ui-play_&]:font-black [.ui-play_&]:text-white",
  };
}

interface ComparisonDashboardProps {
  data: any;
  assessmentName: string;
  assessmentId: string;
  attemptId: string;
  instituteId: string;
  evaluationType?: string;
}

export function ComparisonDashboard({
  data,
  assessmentName,
  assessmentId,
  attemptId,
  instituteId,
  evaluationType,
}: ComparisonDashboardProps) {
  // Manual assessments have no per-question learner responses, so the answer
  // review is meaningless there — hide it entirely.
  //
  // `evaluationType` comes from router navigation state, which is lost on a
  // reload / deep-link — so we can't rely on it alone to decide manual-ness.
  // We additionally derive it from the report detail below (presence of an
  // evaluated copy or a learner submission), then use `effectiveIsManual`
  // everywhere so the report-options menu (View evaluated / View submitted)
  // always shows for manual attempts.
  const isManualFromState = (evaluationType || "").toUpperCase() === "MANUAL";

  // For manual assessments, surface the evaluated copy + the learner's own
  // submission via a report-options menu (in place of the plain Download PDF).
  const [reportFiles, setReportFiles] = useState<{
    evaluated?: string | null;
    submitted?: string | null;
    remark?: string | null;
  }>({});
  const [downloadingReport, setDownloadingReport] = useState(false);
  // True once the report detail confirms this is a manual attempt (has an
  // evaluated copy and/or a learner submission).
  const [isManualFromDetail, setIsManualFromDetail] = useState(false);

  const isManual = isManualFromState || isManualFromDetail;

  // In-app viewer (evaluated / submitted) with the teacher's remark. Renders the
  // file in its actual format (PDF or image), so we track its real name + type.
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerRemark, setViewerRemark] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState<string>("");
  const [viewerFileName, setViewerFileName] = useState<string | undefined>(
    undefined
  );
  const [viewerFileType, setViewerFileType] = useState<string | undefined>(
    undefined
  );
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);

  // Always fetch the report detail — we can't trust the router-state
  // evaluationType (lost on reload/deep-link) to decide whether to load the
  // evaluated copy + submission. If either file is present it's a manual
  // attempt, which flips `isManualFromDetail` and surfaces the options menu.
  useEffect(() => {
    if (!assessmentId || !attemptId || !instituteId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedAxiosInstance.get(STUDENT_REPORT_DETAIL_URL, {
          params: { assessmentId, attemptId, instituteId },
        });
        if (cancelled) return;
        // The teacher's remark rides on the question's evaluator_feedback.
        const allSections = res.data?.all_sections || {};
        let remark: string | null = null;
        for (const questions of Object.values(allSections)) {
          const found = Array.isArray(questions)
            ? (questions as any[]).find((q) => q?.evaluator_feedback)
            : null;
          if (found?.evaluator_feedback) {
            remark = found.evaluator_feedback;
            break;
          }
        }
        const evaluated = res.data?.evaluated_file_id;
        const submitted = res.data?.response_file_id;
        setReportFiles({ evaluated, submitted, remark });
        setIsManualFromDetail(!!evaluated || !!submitted);
      } catch {
        // Best-effort; the menu items just stay disabled if this fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assessmentId, attemptId, instituteId]);

  const openInAppViewer = async (
    fileId: string | null | undefined,
    opts: { remark?: string | null; title: string; fallbackName: string }
  ) => {
    if (!fileId || openingFileId) {
      if (!fileId) toast.error("File not available.");
      return;
    }
    try {
      setOpeningFileId(fileId);
      // Resolve the real name + MIME type so the file renders/downloads in its
      // actual format (the admin may upload a PDF or an image).
      const detail = await getFileDetail(fileId);
      if (!detail?.url) {
        toast.error("Could not open the file.");
        return;
      }
      setViewerUrl(detail.url);
      setViewerFileName(detail.fileName || opts.fallbackName);
      setViewerFileType(detail.fileType);
      setViewerRemark(opts.remark ?? null);
      setViewerTitle(opts.title);
      setViewerOpen(true);
    } catch {
      toast.error("Could not open the file.");
    } finally {
      setOpeningFileId(null);
    }
  };

  const handleDownloadReport = async () => {
    try {
      setDownloadingReport(true);
      const response = await authenticatedAxiosInstance({
        method: "GET",
        url: EXPORT_ASSESSMENT_REPORT,
        params: { assessmentId, attemptId, instituteId },
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${assessmentName || "assessment"}-report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download the report.");
    } finally {
      setDownloadingReport(false);
    }
  };
  const [annotatedOpen, setAnnotatedOpen] = useState(false);
  const [answerReviewOpen, setAnswerReviewOpen] = useState(false);
  const [answerReviewLoading, setAnswerReviewLoading] = useState(false);
  const [reportDetail, setReportDetail] = useState<any>(null);
  const [questionsData, setQuestionsData] = useState<SectionQuestions | null>(null);
  const [sectionsInfo, setSectionsInfo] = useState<{ id: string; name: string }[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | undefined>(undefined);
  const [optionDistribution, setOptionDistribution] = useState<Record<string, Record<string, number>> | null>(null);

  const loadAnswerReview = useCallback(async () => {
    if (reportDetail) {
      setAnswerReviewOpen(true);
      return;
    }

    setAnswerReviewLoading(true);
    try {
      // Fetch report detail, assessment details, and option distribution in parallel
      const [detailRes, assessmentRes, optDistRes] = await Promise.all([
        authenticatedAxiosInstance.get(STUDENT_REPORT_DETAIL_URL, {
          params: { assessmentId, attemptId, instituteId },
        }),
        authenticatedAxiosInstance.get(GET_ASSESSMENT_DETAILS, {
          params: { assessmentId, instituteId, type: "EXAM" },
        }),
        authenticatedAxiosInstance.get(LEARNER_OPTION_DISTRIBUTION_URL, {
          params: { assessmentId, attemptId, instituteId },
        }).catch(() => ({ data: null })),
      ]);

      const detail = detailRes.data;
      setReportDetail(detail);
      setOptionDistribution(optDistRes.data);

      // Extract section info from assessment details
      const sections = assessmentRes.data?.[1]?.saved_data?.sections?.map(
        (s: any) => ({ id: s.id, name: s.name })
      ) || [];
      setSectionsInfo(sections);

      // Set first section as selected
      const allSections = detail?.all_sections;
      const sectionIds = allSections ? Object.keys(allSections) : [];
      if (sectionIds.length > 0) {
        setSelectedSection(sections.length > 0 ? sections[0].id : sectionIds[0]);

        // Fetch questions data for rendering options
        const qRes = await authenticatedAxiosInstance.get(GET_QUESTIONS_OF_SECTIONS, {
          params: { assessmentId, sectionIds: sectionIds.join(",") },
        });
        setQuestionsData(qRes.data);
      }

      setAnswerReviewOpen(true);
    } catch (err) {
      console.error("Error loading answer review:", err);
    } finally {
      setAnswerReviewLoading(false);
    }
  }, [reportDetail, assessmentId, attemptId, instituteId]);

  if (!data) {
    return (
      <EmptyState
        icon={ChartBar}
        title="No comparison data yet"
        description="Batch comparison appears here once your attempt has been evaluated and results are released."
      />
    );
  }

  const {
    student_rank,
    student_percentile,
    student_marks,
    total_marks,
    total_participants,
    average_marks,
    highest_marks,
    lowest_marks,
    average_duration,
    student_duration,
    student_accuracy,
    class_accuracy,
    marks_distribution,
    section_wise_comparison,
    leaderboard,
    start_time,
    submit_time,
  } = data;

  const allSections = reportDetail?.all_sections;
  const currentSectionQuestions = selectedSection && allSections
    ? allSections[selectedSection]
    : undefined;

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const achieved = student_marks != null ? round1(student_marks) : null;
  const maxMarks =
    total_marks != null && total_marks > 0 ? round1(total_marks) : null;
  const scorePct =
    achieved != null && maxMarks != null
      ? Math.round((achieved / maxMarks) * 100)
      : null;
  const verdict = scorePct != null ? getVerdict(scorePct) : null;
  // "Pass" mirrors the success-tier verdicts (Good / Excellent) above.
  const isPassVerdict = scorePct != null && scorePct >= 60;

  // One quiet metadata line replaces the old strip of identical clock chips.
  const metaParts = [
    start_time ? `Attempted ${formatDateTime(start_time)}` : "",
    submit_time ? `Submitted ${formatTime(submit_time)}` : "",
  ].filter(Boolean);

  return (
    <div className="w-full space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold">{assessmentName}</h1>
          <p className="text-sm text-muted-foreground">
            Performance Comparison with Batch
          </p>
        </div>
        {isManual ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Report options">
                <DotsThreeVertical className="h-5 w-5" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={handleDownloadReport}
                disabled={downloadingReport}
              >
                <DownloadSimple className="me-2 h-4 w-4" />
                {downloadingReport ? "Downloading…" : "Download report"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  openInAppViewer(reportFiles.evaluated, {
                    remark: reportFiles.remark,
                    title: "Evaluated answer",
                    fallbackName: `${assessmentName || "assessment"} - evaluated`,
                  })
                }
                disabled={
                  !reportFiles.evaluated ||
                  openingFileId === reportFiles.evaluated
                }
              >
                <Eye className="me-2 h-4 w-4" />
                View evaluated
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  openInAppViewer(reportFiles.submitted, {
                    title: "Your submission",
                    fallbackName: `${assessmentName || "assessment"} - submission`,
                  })
                }
                disabled={
                  !reportFiles.submitted ||
                  openingFileId === reportFiles.submitted
                }
              >
                <FileArrowDown className="me-2 h-4 w-4" />
                View submitted
              </DropdownMenuItem>
              {reportFiles.submitted && (
                <DropdownMenuItem onClick={() => setAnnotatedOpen(true)}>
                  <Sparkle className="me-2 h-4 w-4" />
                  View annotated copy
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <PdfDownloadButton
            assessmentId={assessmentId}
            attemptId={attemptId}
            instituteId={instituteId}
            assessmentName={assessmentName}
          />
        )}
      </div>

      {/* Score hero: the result leads, metadata follows as one quiet line.
          Play mode turns it into a gold celebration band; vibrant gets the
          primary-50 wash + top rail. Default rendering is unchanged. */}
      <Card
        className={cn(
          "[.ui-play_&]:rounded-play-card-sm [.ui-play_&]:border [.ui-play_&]:border-border [.ui-play_&]:bg-play-gold-soft",
          "[.ui-vibrant_&]:border-t-4 [.ui-vibrant_&]:border-t-primary-300 [.ui-vibrant_&]:bg-primary-50"
        )}
      >
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-display tabular-nums text-foreground [.ui-play_&]:font-black [.ui-play_&]:text-play-ink">
                {achieved != null ? achieved : "-"}
              </span>
              {maxMarks != null && (
                <span className="text-title text-muted-foreground tabular-nums [.ui-play_&]:text-play-ink/60">
                  / {maxMarks}
                </span>
              )}
            </div>
            {scorePct != null && (
              <span className="text-subtitle font-semibold tabular-nums text-muted-foreground [.ui-play_&]:font-black [.ui-play_&]:text-play-ink/80">
                {scorePct}%
              </span>
            )}
            {verdict && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption font-semibold",
                  verdict.className
                )}
              >
                {verdict.label}
              </span>
            )}
            {isPassVerdict && (
              <playIllustrations.Winners
                className="pointer-events-none ms-auto hidden h-16 w-auto text-play-accent [.ui-play_&]:!block"
                aria-hidden="true"
              />
            )}
          </div>
          {metaParts.length > 0 && (
            <p className="text-caption text-muted-foreground [.ui-play_&]:font-medium [.ui-play_&]:text-play-ink/70">
              {metaParts.join(" · ")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Distinct stats: rank, percentile, accuracy, time */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          icon={<Trophy size={18} weight="duotone" />}
          label="Rank"
          value={student_rank ? `#${student_rank}` : "-"}
          detail={total_participants ? `of ${total_participants}` : undefined}
        />
        <StatTile
          icon={<ChartLineUp size={18} weight="duotone" />}
          label="Percentile"
          value={
            student_percentile != null ? `${round1(student_percentile)}%` : "-"
          }
        />
        <StatTile
          icon={<Target size={18} weight="duotone" />}
          label="Accuracy"
          value={
            student_accuracy != null
              ? `${Math.round(student_accuracy)}%`
              : "-"
          }
        />
        <StatTile
          icon={<Timer size={18} weight="duotone" />}
          label="Time Taken"
          value={
            student_duration != null && student_duration > 0
              ? formatDuration(student_duration)
              : "-"
          }
        />
      </div>

      {/* Comparison Bars — horizontal cards */}
      <div>
        <h3 className="text-base font-bold mb-3">Your Performance vs Batch</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <ComparisonBar
                label="Marks (You vs Class Avg)"
                yourValue={student_marks}
                avgValue={average_marks}
                maxValue={highest_marks || 100}
                yourLabel={`You: ${Math.round((student_marks || 0) * 10) / 10}`}
                avgLabel={`Avg: ${Math.round((average_marks || 0) * 10) / 10}`}
                color="bg-primary"
              />
            </CardContent>
          </Card>
          {student_duration != null && student_duration > 0 && (
          <Card>
            <CardContent className="pt-5">
              <ComparisonBar
                label="Time Taken (You vs Class Avg)"
                yourValue={student_duration}
                avgValue={average_duration}
                maxValue={Math.max(student_duration || 0, average_duration || 0) * 1.2}
                yourLabel={`You: ${formatDuration(student_duration)}`}
                avgLabel={`Avg: ${average_duration ? formatDuration(Math.round(average_duration)) : "-"}`}
                color="bg-blue-500"
              />
            </CardContent>
          </Card>
          )}
          {student_accuracy != null && (
            <Card>
              <CardContent className="pt-5">
                <ComparisonBar
                  label="Accuracy (You vs Class Avg)"
                  yourValue={student_accuracy}
                  avgValue={class_accuracy || 0}
                  maxValue={100}
                  yourLabel={`You: ${Math.round(student_accuracy)}%`}
                  avgLabel={`Avg: ${class_accuracy != null ? Math.round(class_accuracy) : "-"}%`}
                  color="bg-emerald-500"
                />
              </CardContent>
            </Card>
          )}
        </div>
        <div className="flex gap-6 text-sm text-muted-foreground mt-3">
          <span><strong>Highest:</strong> {highest_marks || "-"}</span>
          <span><strong>Lowest:</strong> {lowest_marks || "-"}</span>
          <span><strong>Participants:</strong> {total_participants || "-"}</span>
        </div>
      </div>

      {/* Section-Wise Performance */}
      {section_wise_comparison && section_wise_comparison.length > 0 && (
        <SectionComparisonTable sections={section_wise_comparison} />
      )}

      {/* Marks Distribution */}
      {marks_distribution && marks_distribution.length > 0 && (
        <MarksDistributionChart
          distribution={marks_distribution}
          studentMarks={student_marks}
          totalParticipants={total_participants}
        />
      )}

      {/* Smart Leaderboard */}
      {leaderboard && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Leaderboard (Your Position)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-start py-2 px-3">Rank</th>
                    <th className="text-start py-2 px-3">Student</th>
                    <th className="text-start py-2 px-3">Marks</th>
                    <th className="text-start py-2 px-3">Time</th>
                    <th className="text-start py-2 px-3">Percentile</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.top_ranks?.map((entry: any) => (
                    <LeaderboardRow
                      key={entry.attempt_id}
                      entry={entry}
                      isCurrentStudent={entry.rank === leaderboard.student_rank}
                    />
                  ))}
                  {leaderboard.has_gap && (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center py-1 text-muted-foreground tracking-widest"
                      >
                        . . . . .
                      </td>
                    </tr>
                  )}
                  {leaderboard.surrounding_ranks?.map((entry: any) => (
                    <LeaderboardRow
                      key={entry.attempt_id}
                      entry={entry}
                      isCurrentStudent={entry.rank === leaderboard.student_rank}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-3">
              Your rank: #{leaderboard.student_rank} of{" "}
              {leaderboard.total_participants} students
            </p>
          </CardContent>
        </Card>
      )}

      {/* Answer Review — lazy loaded. Shown for MANUAL attempts too so learners
          see their per-question marks, AI/teacher feedback and criteria. */}
      {!answerReviewOpen ? (
        <Card>
          <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-base">Answer Review</h3>
              <p className="text-sm text-muted-foreground">
                View question-wise answers, correct responses, and explanations
              </p>
            </div>
            <button
              onClick={loadAnswerReview}
              disabled={answerReviewLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 whitespace-nowrap disabled:opacity-50"
            >
              {answerReviewLoading ? "Loading..." : "View Answer Review"}
            </button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Section Tabs */}
          {sectionsInfo.length > 0 && (
            <Tabs
              value={selectedSection}
              onValueChange={setSelectedSection}
              className="w-full"
            >
              <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200">
                <TabsList className="h-auto bg-transparent p-0 w-full justify-start overflow-x-auto">
                  {sectionsInfo.map((section) => (
                    <TabsTrigger
                      key={section.id}
                      value={section.id}
                      className="relative px-6 py-4 rounded-none border-b-2 transition-all
                        data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:font-semibold
                        data-[state=inactive]:border-transparent data-[state=inactive]:text-slate-600
                        hover:text-slate-900 hover:bg-slate-50"
                    >
                      <span>{section.name}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
          )}

          {/* Questions */}
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900">Answer Review</CardTitle>
              <CardDescription className="mt-1">Detailed analysis of your responses</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {currentSectionQuestions && currentSectionQuestions.length > 0 ? (
                currentSectionQuestions.map((review: any, index: number) => (
                  <Card key={index} className="border-slate-200 hover:shadow-md transition-shadow">
                    <CardHeader className="bg-slate-50 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="text-lg font-semibold text-slate-900">
                              Question {index + 1}
                            </CardTitle>
                            <Badge variant="secondary" className="text-xs">
                              {review.question_type}
                            </Badge>
                          </div>
                          <div className="text-sm text-slate-700 leading-relaxed">
                            {parseHtmlToString(review.question_name)}
                          </div>
                        </div>
                        {review.time_taken_in_seconds != null && review.time_taken_in_seconds > 0 && (
                          <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200">
                            <Clock size={16} weight="duotone" className="text-slate-500" />
                            <span className="font-medium">{review.time_taken_in_seconds}s</span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                      {/* Student Response */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-slate-700">Your Response</span>
                          <MarksStatusIndicator
                            mark={review.mark}
                            answer_status={review.answer_status as "CORRECT" | "INCORRECT" | "PARTIAL_CORRECT" | "DEFAULT"}
                          />
                        </div>
                        <Alert
                          className={`border-s-4 ${
                            review.answer_status === "CORRECT"
                              ? "border-s-emerald-500 bg-emerald-50/50 border-emerald-200"
                              : review.answer_status === "INCORRECT"
                                ? "border-s-rose-500 bg-rose-50/50 border-rose-200"
                                : review.answer_status === "PARTIAL_CORRECT"
                                  ? "border-s-amber-500 bg-amber-50/50 border-amber-200"
                                  : "border-s-slate-500 bg-slate-50/50 border-slate-200"
                          }`}
                        >
                          <AlertDescription className="text-sm text-slate-700">
                            {review.student_response_options
                              ? renderStudentResponse(review, questionsData)
                              : review.mark !== 0
                                ? `Marks awarded directly (${review.mark > 0 ? "+" : ""}${review.mark})`
                                : "Not Attempted"}
                          </AlertDescription>
                        </Alert>
                      </div>

                      {/* Correct Answer */}
                      {review.answer_status !== "CORRECT" && review.correct_options && (
                        <div className="space-y-2">
                          <span className="text-sm font-semibold text-slate-700">Correct Answer</span>
                          <Alert className="border-s-4 border-s-emerald-500 bg-emerald-50/50 border-emerald-200">
                            <AlertDescription className="text-sm text-slate-700">
                              {renderCorrectAnswer(review, questionsData)}
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}

                      {/* Feedback + grading breakdown (AI evaluation / teacher remark) */}
                      {(review.evaluator_feedback || review.ai_feedback || review.ai_criteria_breakdown) && (
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700">Feedback</span>
                            {(review.evaluation_source === "AI" ||
                              review.evaluation_source === "AI_REVIEWED") && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Sparkle size={12} weight="fill" />
                                {review.evaluation_source === "AI_REVIEWED"
                                  ? "AI-assisted, teacher-reviewed"
                                  : "AI-assisted"}
                              </Badge>
                            )}
                          </div>
                          {(review.evaluator_feedback || review.ai_feedback) && (
                            <Alert className="border-s-4 border-s-violet-500 bg-violet-50/50 border-violet-200">
                              <AlertDescription className="text-sm text-slate-700 whitespace-pre-line">
                                {review.evaluator_feedback || review.ai_feedback}
                              </AlertDescription>
                            </Alert>
                          )}
                          {(() => {
                            let criteria: any[] = [];
                            try {
                              criteria = review.ai_criteria_breakdown
                                ? JSON.parse(review.ai_criteria_breakdown)
                                : [];
                            } catch {
                              criteria = [];
                            }
                            if (!Array.isArray(criteria) || criteria.length === 0) return null;
                            return (
                              <div className="rounded-md border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <th className="text-start p-2 text-xs font-semibold text-slate-600 uppercase">
                                        Criteria
                                      </th>
                                      <th className="text-start p-2 text-xs font-semibold text-slate-600 uppercase">
                                        Reason
                                      </th>
                                      <th className="text-end p-2 text-xs font-semibold text-slate-600 uppercase">
                                        Marks
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {criteria.map((c: any, i: number) => (
                                      <tr key={i}>
                                        <td className="p-2 font-medium text-slate-800">
                                          {c.criteria_name}
                                        </td>
                                        <td className="p-2 text-slate-600">{c.reason}</td>
                                        <td className="p-2 text-end font-semibold text-slate-800">
                                          {typeof c.marks === "number" ? c.marks.toFixed(1) : c.marks}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Option Distribution */}
                      {optionDistribution && review.question_id && optionDistribution[review.question_id] &&
                        ["MCQS", "MCQM", "TRUE_FALSE"].includes(review.question_type) && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <span className="text-sm font-semibold text-slate-700">How others answered</span>
                          <div className="space-y-1.5">
                            {(() => {
                              const dist = optionDistribution[review.question_id];
                              // Find all options for this question from questionsData
                              const questionOptions = questionsData
                                ? Object.values(questionsData).flatMap(sq =>
                                    sq.filter(q => q.question_id === review.question_id)
                                      .flatMap(q => q.options_with_explanation || q.options || [])
                                  )
                                : [];

                              return questionOptions.map((opt: any) => {
                                const pct = dist[opt.id] || 0;
                                return (
                                  <div key={opt.id} className="flex items-center gap-2">
                                    <div className="flex-1">
                                      <div className="flex justify-between text-xs mb-0.5">
                                        <span className="text-slate-600 truncate max-w-reg-200">
                                          {parseHtmlToString(opt.text?.content || opt.id)}
                                        </span>
                                        <span className="text-slate-500 font-medium ms-2">{pct}%</span>
                                      </div>
                                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-slate-400 rounded-full"
                                          style={{ width: `${Math.min(pct, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Explanation */}
                      {review.explanation && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <span className="text-sm font-semibold text-slate-700">Explanation</span>
                          <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4 leading-relaxed">
                            {parseHtmlToString(review.explanation)}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <EmptyState
                  compact
                  icon={ListChecks}
                  title="No questions in this section"
                  description="Pick another section tab to review the rest of your answers."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      <EvaluatedReportDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        fileUrl={viewerUrl}
        fileName={viewerFileName}
        fileType={viewerFileType}
        remark={viewerRemark}
        title={viewerTitle}
      />

      <AnnotatedCopyDialog
        open={annotatedOpen}
        onOpenChange={setAnnotatedOpen}
        assessmentId={assessmentId}
        attemptId={attemptId}
        submittedFileId={reportFiles.submitted}
      />
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-3xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-body font-semibold tabular-nums text-foreground">
          {value}
          {detail && (
            <span className="ms-1 text-caption font-normal text-muted-foreground">
              {detail}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ComparisonBar({
  label,
  yourValue,
  avgValue,
  maxValue,
  yourLabel,
  avgLabel,
  color,
}: {
  label: string;
  yourValue: number;
  avgValue: number;
  maxValue: number;
  yourLabel: string;
  avgLabel: string;
  color: string;
}) {
  const yourPct = maxValue > 0 ? Math.min((yourValue / maxValue) * 100, 100) : 0;
  const avgPct = maxValue > 0 ? Math.min((avgValue / maxValue) * 100, 100) : 0;

  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="relative h-2 bg-muted rounded-full">
        {/* Your score fill */}
        <div
          className={`absolute start-0 top-0 h-full rounded-full ${color}`}
          style={{ width: `${yourPct}%` }}
        />
        {/* Average marker slit */}
        <div
          className="absolute -top-0.5 w-0.5 h-3.5 bg-slate-800 rounded-sm"
          style={{ left: `${avgPct}%` }}
          title={`Class Average: ${avgLabel}`}
        />
      </div>
      <div className="flex justify-between text-xs mt-1">
        <span className="font-semibold text-primary">{yourLabel}</span>
        <span className="text-muted-foreground">{avgLabel}</span>
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  isCurrentStudent,
}: {
  entry: any;
  isCurrentStudent: boolean;
}) {
  const rankBadgeClass =
    entry.rank === 1
      ? "bg-yellow-400 text-black"
      : entry.rank === 2
        ? "bg-gray-300 text-black"
        : entry.rank === 3
          ? "bg-amber-600 text-white"
          : "bg-muted text-muted-foreground";

  return (
    <tr className={isCurrentStudent ? "bg-orange-50 font-semibold" : ""}>
      <td className="py-2 px-3">
        <Badge variant="outline" className={`${rankBadgeClass} text-xs w-7 h-7 rounded-full flex items-center justify-center`}>
          {entry.rank}
        </Badge>
      </td>
      <td className="py-2 px-3">
        {isCurrentStudent ? `${entry.student_name} (You)` : entry.student_name}
      </td>
      <td className="py-2 px-3 font-medium">
        {entry.achieved_marks != null ? Math.round(entry.achieved_marks * 10) / 10 : "-"}
      </td>
      <td className="py-2 px-3">
        {entry.completion_time_in_seconds
          ? formatDuration(entry.completion_time_in_seconds)
          : "-"}
      </td>
      <td className="py-2 px-3">
        {entry.percentile != null ? `${Math.round(entry.percentile * 10) / 10}%` : "-"}
      </td>
    </tr>
  );
}
