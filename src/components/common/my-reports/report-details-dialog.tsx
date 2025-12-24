"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { MyDialog } from "@/components/design-system/dialog";
import { StudentReport } from "@/services/student-reports-api";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

interface ReportDetailsDialogProps {
  report: StudentReport | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReportDetailsDialog({
  report,
  isOpen,
  onClose,
}: ReportDetailsDialogProps) {
  if (!report) return null;

  const renderSection = (title: string, content: string) => (
    <Card className="mb-6 p-2">
      <CardTitle className="text-lg font-semibold text-neutral-800 mb-3">
        {title}
      </CardTitle>
      <CardContent className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkBreaks]}>{content}</ReactMarkdown>
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

    // Filter out entries with 0% score
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const filteredData = Object.entries(data).filter(([_, score]) => score > 0);

    if (filteredData.length === 0) {
      return null;
    }

    return (
      <Card className="mb-6 w-full p-2">
        <CardTitle className="text-lg font-semibold text-neutral-800 mb-3">
          {title}
        </CardTitle>
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

  const heading = `Report: ${format(
    new Date(report.start_date_iso),
    "MMM dd, yyyy"
  )} - ${format(new Date(report.end_date_iso), "MMM dd, yyyy")}`;

  const description = `Generated on ${format(
    new Date(report.created_at),
    "MMM dd, yyyy"
  )}`;

  return (
    <MyDialog
      heading={heading}
      open={isOpen}
      onOpenChange={onClose}
      dialogWidth="max-w-4xl"
      className="max-h-[80vh]"
    >
      <div className="mb-4 text-sm text-neutral-600">{description}</div>
      <div className="flex flex-col md:flex-row gap-2 w-full">
        {Object.keys(report.report.strengths).length > 0 &&
          renderStrengthsWeaknesses("Strengths", report.report.strengths, true)}

        {Object.keys(report.report.weaknesses).length > 0 &&
          renderStrengthsWeaknesses(
            "Areas for Improvement",
            report.report.weaknesses,
            false
          )}
      </div>
      <div className="space-y-6">
        {renderSection("Overall Progress", report.report.progress)}
        {renderSection("Learning Frequency", report.report.learning_frequency)}
        {renderSection(
          "Topics of Improvement",
          report.report.topics_of_improvement
        )}
        {renderSection(
          "Topics Needing Attention",
          report.report.topics_of_degradation
        )}
        {renderSection(
          "Recommended Remedial Actions",
          report.report.remedial_points
        )}
      </div>
    </MyDialog>
  );
}
