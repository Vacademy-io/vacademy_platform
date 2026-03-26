"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  Target,
  Zap,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { MyButton } from "@/components/design-system/button";
import { Export } from "phosphor-react";
import { generateReportPdf } from "./ai-report-pdf-export";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface AIReportData {
  version?: number;
  quick_summary?: {
    total_score: number;
    max_score: number;
    accuracy_pct: number;
    time_used_seconds: number;
    time_allowed_seconds: number;
    questions_attempted: number;
    questions_total: number;
    performance_band: "excellent" | "good" | "average" | "needs_work";
    encouragement: string;
  };
  section_scores?: {
    name: string;
    score: number;
    max_score: number;
    accuracy_pct: number;
    time_spent_seconds: number;
  }[];
  difficulty_breakdown?: {
    easy: { attempted: number; correct: number };
    medium: { attempted: number; correct: number };
    hard: { attempted: number; correct: number };
  };
  time_analysis?: {
    avg_time_per_question_seconds: number;
    fastest_question_seconds: number;
    slowest_question_seconds: number;
    rushed_count: number;
    overtime_count: number;
  };
  conceptual_gaps?: {
    concept: string;
    evidence: string;
    suggestion: string;
  }[];
  question_results?: {
    question_number: number;
    section: string;
    correct: boolean;
    attempted: boolean;
    time_seconds: number;
    difficulty: string;
    marked_for_review: boolean;
  }[];
  performance_analysis: string;
  weaknesses: Record<string, number>;
  strengths: Record<string, number>;
  areas_of_improvement?: string;
  improvement_path: string;
  flashcards: { front: string; back: string }[];
}

interface AIReportDetailsPageProps {
  report: AIReportData;
  assessmentId: string;
  assessmentName: string;
}

const BAND_CONFIG = {
  excellent: { label: "Excellent", color: "bg-green-100 text-green-800 border-green-300" },
  good: { label: "Good", color: "bg-blue-100 text-blue-800 border-blue-300" },
  average: { label: "Average", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  needs_work: { label: "Needs Work", color: "bg-red-100 text-red-800 border-red-300" },
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

export default function AIReportDetailsPage({
  report,
  assessmentId,
  assessmentName,
}: AIReportDetailsPageProps) {
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = async () => {
    if (!reportRef.current || isExporting) return;
    setIsExporting(true);
    try {
      await generateReportPdf(reportRef.current, {
        assessmentId,
        assessmentName,
        conceptualGaps: report.conceptual_gaps,
      });
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const isV2 = report.version === 2;

  // Sanitize markdown content: fix literal "\n" strings that LLMs sometimes produce
  const sanitizeMarkdown = (text: string): string => {
    if (!text) return "";
    return text
      // Replace literal \n sequences with actual newlines
      .replace(/\\n/g, "\n")
      // Ensure numbered lists have proper spacing
      .replace(/(\d+)\.\s*/g, "\n$1. ")
      // Ensure bullet points have proper spacing
      .replace(/(?<!\n)-\s+/g, "\n- ")
      // Clean up excessive newlines
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const renderSection = (title: string, content: string) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-neutral-800">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkBreaks]}>
          {sanitizeMarkdown(content)}
        </ReactMarkdown>
      </CardContent>
    </Card>
  );

  const renderStrengthsWeaknesses = (
    title: string,
    data: Record<string, number>,
    isStrength: boolean = true
  ) => {
    const progressClassName = isStrength
      ? "[&>div]:bg-green-500 bg-green-100"
      : "[&>div]:bg-red-500 bg-red-100";

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const filteredData = Object.entries(data).filter(([_, score]) => score > 0);

    if (filteredData.length === 0) {
      return null;
    }

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-neutral-800">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {filteredData.map(([subject, score]) => (
            <div key={subject} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">{subject}</span>
                <span className="text-sm text-neutral-600">{score}%</span>
              </div>
              <Progress value={score} className={progressClassName} />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  // ── Quick Summary Banner (v2) ──
  const renderQuickSummary = () => {
    if (!isV2 || !report.quick_summary) return null;
    const qs = report.quick_summary;
    const bandCfg = BAND_CONFIG[qs.performance_band] || BAND_CONFIG.average;

    const stats = [
      {
        label: "Score",
        value: `${qs.total_score}/${qs.max_score}`,
        icon: <Target className="h-5 w-5 text-indigo-500" />,
      },
      {
        label: "Accuracy",
        value: `${qs.accuracy_pct}%`,
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      },
      {
        label: "Time Used",
        value: qs.time_allowed_seconds > 0
          ? `${formatTime(qs.time_used_seconds)} / ${formatTime(qs.time_allowed_seconds)}`
          : formatTime(qs.time_used_seconds),
        icon: <Clock className="h-5 w-5 text-blue-500" />,
      },
      {
        label: "Questions",
        value: `${qs.questions_attempted}/${qs.questions_total}`,
        icon: <TrendingUp className="h-5 w-5 text-orange-500" />,
      },
    ];

    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className={`text-sm px-3 py-1 ${bandCfg.color}`}>
                {bandCfg.label}
              </Badge>
              {qs.encouragement && (
                <p className="text-sm text-neutral-600 italic">
                  {qs.encouragement}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center"
                >
                  {stat.icon}
                  <span className="text-xl font-bold text-neutral-900">
                    {stat.value}
                  </span>
                  <span className="text-xs text-neutral-500">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ── Section Scores Bar Chart (v2) ──
  const renderSectionScores = () => {
    if (!isV2 || !report.section_scores || report.section_scores.length < 2)
      return null;

    const data = report.section_scores.map((s) => ({
      name: s.name,
      score: s.score,
      max: s.max_score,
      accuracy: s.accuracy_pct,
    }));

    const getBarColor = (accuracy: number) => {
      if (accuracy >= 80) return "#22c55e";
      if (accuracy >= 60) return "#3b82f6";
      if (accuracy >= 40) return "#f59e0b";
      return "#ef4444";
    };

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-neutral-800">
            Section-wise Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 50)}>
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                width={120}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number, name: string, props: { payload: { max: number; accuracy: number } }) => {
                  if (name === "score")
                    return [`${value}/${props.payload.max} (${props.payload.accuracy}%)`, "Score"];
                  return [value, name];
                }}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={24}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry.accuracy)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  // ── Difficulty Breakdown (v2) ──
  const renderDifficultyBreakdown = () => {
    if (!isV2 || !report.difficulty_breakdown) return null;
    const db = report.difficulty_breakdown;

    const hasData =
      (db.easy?.attempted || 0) + (db.medium?.attempted || 0) + (db.hard?.attempted || 0) > 0;
    if (!hasData) return null;

    const levels = [
      { label: "Easy", ...db.easy, color: "#22c55e" },
      { label: "Medium", ...db.medium, color: "#f59e0b" },
      { label: "Hard", ...db.hard, color: "#ef4444" },
    ];

    const pieData = levels
      .filter((l) => l.attempted > 0)
      .map((l) => ({
        name: l.label,
        value: l.correct,
        total: l.attempted,
        fill: l.color,
      }));

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-neutral-800">
            Difficulty Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name: string, props: { payload: { total: number } }) =>
                    [`${value}/${props.payload.total} correct`]
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3 flex-1">
              {levels.map((level) => {
                const pct =
                  level.attempted > 0
                    ? Math.round((level.correct / level.attempted) * 100)
                    : 0;
                return (
                  <div key={level.label} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: level.color }}
                    />
                    <span className="text-sm font-medium w-16">{level.label}</span>
                    <Progress
                      value={pct}
                      className="flex-1 h-2 [&>div]:transition-all"
                      style={{ ["--tw-bg-opacity" as string]: 0.15 } as React.CSSProperties}
                    />
                    <span className="text-sm text-neutral-600 w-24 text-right">
                      {level.correct}/{level.attempted} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ── Time Analysis Card (v2) ──
  const renderTimeAnalysis = () => {
    if (!isV2 || !report.time_analysis) return null;
    const ta = report.time_analysis;

    if (!ta.avg_time_per_question_seconds && !ta.fastest_question_seconds) return null;

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-blue-50">
              <p className="text-2xl font-bold text-blue-700">
                {formatTime(ta.avg_time_per_question_seconds)}
              </p>
              <p className="text-xs text-blue-600">Avg per Question</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50">
              <p className="text-2xl font-bold text-green-700">
                {formatTime(ta.fastest_question_seconds)}
              </p>
              <p className="text-xs text-green-600">Fastest</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-orange-50">
              <p className="text-2xl font-bold text-orange-700">
                {formatTime(ta.slowest_question_seconds)}
              </p>
              <p className="text-xs text-orange-600">Slowest</p>
            </div>
          </div>
          {(ta.rushed_count > 0 || ta.overtime_count > 0) && (
            <div className="flex flex-wrap gap-3 mt-4">
              {ta.rushed_count > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 gap-1">
                  <Zap className="h-3 w-3" />
                  {ta.rushed_count} rushed (under 15s)
                </Badge>
              )}
              {ta.overtime_count > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {ta.overtime_count} overtime (2x avg)
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Question Results Grid (v2) ──
  const renderQuestionResults = () => {
    if (!isV2 || !report.question_results || report.question_results.length === 0)
      return null;

    const results = report.question_results;

    const getResultColor = (q: (typeof results)[0]) => {
      if (!q.attempted) return "bg-neutral-100 border-neutral-300 text-neutral-400";
      if (q.correct) return "bg-green-100 border-green-400 text-green-700";
      return "bg-red-100 border-red-400 text-red-700";
    };

    const getResultLabel = (q: (typeof results)[0]) => {
      if (!q.attempted) return "—";
      return q.correct ? "✓" : "✗";
    };

    // Build bar chart data for time per question
    const timeChartData = results
      .filter((q) => q.attempted)
      .map((q) => ({
        name: `Q${q.question_number}`,
        time: q.time_seconds,
        correct: q.correct,
      }));

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-neutral-800">
            Question-by-Question Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Heatmap grid */}
          <div>
            <p className="text-sm text-neutral-500 mb-3">
              Each cell represents a question. Green = correct, Red = incorrect, Gray = not attempted.
            </p>
            <div className="flex flex-wrap gap-2">
              {results.map((q) => (
                <div
                  key={q.question_number}
                  className={`w-10 h-10 rounded-md border flex items-center justify-center text-sm font-semibold cursor-default ${getResultColor(q)}`}
                  title={`Q${q.question_number} | ${q.difficulty} | ${q.time_seconds}s${q.marked_for_review ? " | Marked for review" : ""}`}
                >
                  <span className="text-xs absolute -mt-8 text-neutral-400">
                  </span>
                  {getResultLabel(q)}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-400 inline-block" /> Correct
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-400 inline-block" /> Incorrect
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-neutral-100 border border-neutral-300 inline-block" /> Skipped
              </span>
            </div>
          </div>

          {/* Time per question bar chart */}
          {timeChartData.length > 1 && (
            <div>
              <p className="text-sm font-medium text-neutral-700 mb-2">Time per Question</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={timeChartData} margin={{ left: 0, right: 10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: "seconds", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                  <Tooltip formatter={(value: number) => [`${value}s`, "Time"]} />
                  <Bar dataKey="time" radius={[3, 3, 0, 0]} barSize={20}>
                    {timeChartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.correct ? "#22c55e" : "#ef4444"}
                        opacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Conceptual Gaps Accordion (v2) ──
  const renderConceptualGaps = () => {
    if (!isV2 || !report.conceptual_gaps || report.conceptual_gaps.length === 0) {
      // Fallback to v1 areas_of_improvement
      if (report.areas_of_improvement) {
        return renderSection("Areas of Improvement", report.areas_of_improvement);
      }
      return null;
    }

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Conceptual Gaps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {report.conceptual_gaps.map((gap, index) => (
              <AccordionItem key={index} value={`gap-${index}`}>
                <AccordionTrigger className="text-sm font-medium text-left">
                  {gap.concept}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-red-600">Evidence: </span>
                      <span className="text-neutral-700">{gap.evidence}</span>
                    </div>
                    <div>
                      <span className="font-medium text-green-600">Suggestion: </span>
                      <span className="text-neutral-700">{gap.suggestion}</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    );
  };

  // ── Flashcards (unchanged) ──
  const nextFlashcard = () => {
    setCurrentFlashcardIndex((prev) =>
      prev === report.flashcards.length - 1 ? 0 : prev + 1
    );
    setShowAnswer(false);
  };

  const prevFlashcard = () => {
    setCurrentFlashcardIndex((prev) =>
      prev === 0 ? report.flashcards.length - 1 : prev - 1
    );
    setShowAnswer(false);
  };

  const flipCard = () => {
    setShowAnswer(!showAnswer);
  };

  const currentFlashcard = report.flashcards?.[currentFlashcardIndex];

  return (
    <div className="px-2 py-4 w-full relative">
      <MyButton
        className="absolute top-4 right-4 flex items-center gap-2"
        buttonType="secondary"
        scale="medium"
        layoutVariant="default"
        onClick={handleExportPdf}
        disabled={isExporting}
        data-no-print
      >
        <Export />
        {isExporting ? "Exporting..." : "Export"}
      </MyButton>
      <div className="space-y-6 p-2" ref={reportRef}>
        <div className="mb-8">
          <h1 className="text-lg md:text-3xl font-bold text-neutral-900 mb-2">
            AI Assessment Report
          </h1>
          <p className="text-neutral-600">Assessment : {assessmentName}</p>
        </div>

        {/* Quick Summary Banner (v2) */}
        {renderQuickSummary()}

        {/* Performance Analysis */}
        {renderSection("Performance Analysis", report.performance_analysis)}

        {/* Section Scores & Difficulty Breakdown (v2) */}
        {isV2 && (
          <div className="grid md:grid-cols-2 gap-6">
            {renderSectionScores()}
            {renderDifficultyBreakdown()}
          </div>
        )}

        {/* Time Analysis (v2) */}
        {renderTimeAnalysis()}

        {/* Question Results Grid (v2) */}
        {renderQuestionResults()}

        {/* Strengths and Weaknesses */}
        <div className="grid md:grid-cols-2 gap-6">
          {Object.keys(report.strengths).length > 0 &&
            renderStrengthsWeaknesses("Strengths", report.strengths, true)}

          {Object.keys(report.weaknesses).length > 0 &&
            renderStrengthsWeaknesses(
              "Areas for Improvement",
              report.weaknesses,
              false
            )}
        </div>

        {/* Conceptual Gaps (v2) or Areas of Improvement (v1) */}
        {renderConceptualGaps()}

        {/* Improvement Path */}
        {renderSection("Improvement Path", report.improvement_path)}
      </div>

      <div className="mt-6">
        {/* Flashcards Section */}
        {report.flashcards && report.flashcards.length > 0 && currentFlashcard && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
                Flashcards
                <span className="text-sm font-normal text-neutral-600">
                  ({currentFlashcardIndex + 1} of {report.flashcards.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                {/* Flashcard */}
                <div
                  className="w-full max-w-md h-64 bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200 rounded-lg cursor-pointer transition-all duration-300 hover:shadow-lg flex items-center justify-center p-6"
                  onClick={flipCard}
                >
                  <div className="text-center">
                    {showAnswer ? (
                      <div>
                        <div className="text-sm text-blue-600 mb-2 font-medium">
                          Answer
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                            {sanitizeMarkdown(currentFlashcard.back)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm text-blue-600 mb-2 font-medium">
                          Question
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                            {sanitizeMarkdown(currentFlashcard.front)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prevFlashcard}
                    disabled={report.flashcards.length <= 1}
                  >
                    <ChevronLeft size={16} />
                  </Button>

                  <Button variant="outline" size="sm" onClick={flipCard}>
                    <RotateCcw size={16} className="mr-1" />
                    {showAnswer ? "Show Question" : "Show Answer"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={nextFlashcard}
                    disabled={report.flashcards.length <= 1}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
