"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { usePDF } from "react-to-pdf";
import { MyButton } from "@/components/design-system/button";
import { Export } from "phosphor-react";

interface AIReportData {
  performance_analysis: string;
  weaknesses: Record<string, number>;
  strengths: Record<string, number>;
  areas_of_improvement: string;
  improvement_path: string;
  flashcards: { front: string; back: string }[];
}

interface AIReportDetailsPageProps {
  report: AIReportData;
  assessmentId: string;
  assessmentName: string;
}

export default function AIReportDetailsPage({
  report,
  assessmentId,
  assessmentName,
}: AIReportDetailsPageProps) {
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const { toPDF, targetRef } = usePDF({
    filename: `AI_Assessment_Report_${assessmentId}.pdf`,
  });

  const renderSection = (title: string, content: string) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-neutral-800">
          {title}
        </CardTitle>
      </CardHeader>
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

  const currentFlashcard = report.flashcards[currentFlashcardIndex];

  return (
    <div className="px-2 py-4 w-full  relative">
      <MyButton
        className="absolute top-4 right-4 flex items-center gap-2"
        buttonType="secondary"
        scale="medium"
        layoutVariant="default"
        onClick={() => toPDF()}
      >
        <Export />
        Export
      </MyButton>
      <div className="space-y-6 p-2" ref={targetRef}>
        <div className="mb-8">
          <h1 className="text-lg md:text-3xl font-bold text-neutral-900 mb-2">
            AI Assessment Report
          </h1>
          <p className="text-neutral-600">Assessment : {assessmentName}</p>
        </div>
        {/* Performance Analysis */}
        {renderSection("Performance Analysis", report.performance_analysis)}

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

        {/* Areas of Improvement */}
        {renderSection("Areas of Improvement", report.areas_of_improvement)}

        {/* Improvement Path */}
        {renderSection("Improvement Path", report.improvement_path)}
      </div>

      <div className="mt-6">
        {/* Flashcards Section */}
        {report.flashcards && report.flashcards.length > 0 && (
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
                            {currentFlashcard.back}
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
                            {currentFlashcard.front}
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
