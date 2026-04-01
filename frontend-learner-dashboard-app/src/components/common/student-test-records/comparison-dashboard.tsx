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
import { MarksDistributionChart } from "./marks-distribution-chart";
import { SectionComparisonTable } from "./section-comparison-table";
import { MarksStatusIndicator } from "./marks-chip";
import { formatDuration } from "@/constants/helper";
import { parseHtmlToString } from "@/lib/utils";
import { useState, useCallback } from "react";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  STUDENT_REPORT_DETAIL_URL,
  GET_QUESTIONS_OF_SECTIONS,
  GET_ASSESSMENT_DETAILS,
  LEARNER_OPTION_DISTRIBUTION_URL,
} from "@/constants/urls";
import {
  renderStudentResponse,
  renderCorrectAnswer,
  type SectionQuestions,
} from "./question-response-renderer";
import { Clock } from "@phosphor-icons/react";

interface ComparisonDashboardProps {
  data: any;
  assessmentName: string;
  assessmentId: string;
  attemptId: string;
  instituteId: string;
}

export function ComparisonDashboard({
  data,
  assessmentName,
  assessmentId,
  attemptId,
  instituteId,
}: ComparisonDashboardProps) {
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
      <div className="text-center py-8 text-muted-foreground">
        No comparison data available
      </div>
    );
  }

  const {
    student_rank,
    student_percentile,
    student_marks,
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      });
    } catch { return null; }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
      });
    } catch { return null; }
  };

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
        <PdfDownloadButton
          assessmentId={assessmentId}
          attemptId={attemptId}
          instituteId={instituteId}
          assessmentName={assessmentName}
        />
      </div>

      {/* Attempt Metadata */}
      {(start_time || submit_time || student_duration) && (() => {
        const visibleCards = [
          !!formatDate(start_time),
          student_duration != null && student_duration > 0,
          !!formatTime(start_time),
          !!formatTime(submit_time),
        ].filter(Boolean).length;
        const gridCols = visibleCards <= 2 ? "md:grid-cols-2" : visibleCards === 3 ? "md:grid-cols-3" : "md:grid-cols-4";
        return (
        <div className={`grid grid-cols-2 ${gridCols} gap-3`}>
          {formatDate(start_time) && (
            <div className="flex items-center gap-3 px-4 py-3 bg-white border rounded-lg">
              <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 text-sm">
                <Clock size={18} weight="duotone" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Attempt Date</div>
                <div className="text-sm font-semibold">{formatDate(start_time)}</div>
              </div>
            </div>
          )}
          {student_duration != null && student_duration > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-white border rounded-lg">
              <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 text-sm">
                <Clock size={18} weight="duotone" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Duration</div>
                <div className="text-sm font-semibold">{formatDuration(student_duration)}</div>
              </div>
            </div>
          )}
          {formatTime(start_time) && (
            <div className="flex items-center gap-3 px-4 py-3 bg-white border rounded-lg">
              <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 text-sm">
                <Clock size={18} weight="duotone" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Start Time</div>
                <div className="text-sm font-semibold">{formatTime(start_time)}</div>
              </div>
            </div>
          )}
          {formatTime(submit_time) && (
            <div className="flex items-center gap-3 px-4 py-3 bg-white border rounded-lg">
              <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 text-sm">
                <Clock size={18} weight="duotone" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">End Time</div>
                <div className="text-sm font-semibold">{formatTime(submit_time)}</div>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Score Overview Cards */}
      <div className={`grid grid-cols-2 ${student_duration != null && student_duration > 0 ? "md:grid-cols-4" : "md:grid-cols-3"} gap-4`}>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-extrabold text-primary">
              {student_marks != null ? Math.round(student_marks * 10) / 10 : "-"}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
              Marks Obtained
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-extrabold text-violet-600">
              #{student_rank || "-"}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
              Rank (of {total_participants || "-"})
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-extrabold text-emerald-600">
              {student_percentile != null
                ? Math.round(student_percentile * 10) / 10
                : "-"}
              %
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
              Percentile
            </div>
          </CardContent>
        </Card>
        {student_duration != null && student_duration > 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-extrabold text-blue-600">
                {formatDuration(student_duration)}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
                Time Taken
              </div>
            </CardContent>
          </Card>
        )}
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
                    <th className="text-left py-2 px-3">Rank</th>
                    <th className="text-left py-2 px-3">Student</th>
                    <th className="text-left py-2 px-3">Marks</th>
                    <th className="text-left py-2 px-3">Time</th>
                    <th className="text-left py-2 px-3">Percentile</th>
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

      {/* Answer Review — lazy loaded */}
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
                          className={`border-l-4 ${
                            review.answer_status === "CORRECT"
                              ? "border-l-emerald-500 bg-emerald-50/50 border-emerald-200"
                              : review.answer_status === "INCORRECT"
                                ? "border-l-rose-500 bg-rose-50/50 border-rose-200"
                                : review.answer_status === "PARTIAL_CORRECT"
                                  ? "border-l-amber-500 bg-amber-50/50 border-amber-200"
                                  : "border-l-slate-500 bg-slate-50/50 border-slate-200"
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
                          <Alert className="border-l-4 border-l-emerald-500 bg-emerald-50/50 border-emerald-200">
                            <AlertDescription className="text-sm text-slate-700">
                              {renderCorrectAnswer(review, questionsData)}
                            </AlertDescription>
                          </Alert>
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
                                        <span className="text-slate-600 truncate max-w-[200px]">
                                          {parseHtmlToString(opt.text?.content || opt.id)}
                                        </span>
                                        <span className="text-slate-500 font-medium ml-2">{pct}%</span>
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
                <div className="text-center py-12 text-slate-500">
                  <p className="text-lg">No questions available for review</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
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
          className={`absolute left-0 top-0 h-full rounded-full ${color}`}
          style={{ width: `${yourPct}%` }}
        />
        {/* Average marker slit */}
        <div
          className="absolute top-[-3px] w-[3px] h-[14px] bg-slate-800 rounded-sm"
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
