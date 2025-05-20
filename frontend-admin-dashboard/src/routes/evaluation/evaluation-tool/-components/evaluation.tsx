"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"; // Assuming you have a Tabs component
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { MyDialog } from "@/components/design-system/dialog";
import { useTimerStore } from "@/stores/evaluation/timer-store";
import { useMarksStore } from "@/stores/evaluation/marks-store";
import { ArrowSquareOut } from "phosphor-react";

interface QuestionData {
    question_id: string;
    question_order: number;
    marking_json: string;
    section_id: string;
    question: {
        content: string;
    };
}

interface EvaluationProps {
    questionData: Record<string, QuestionData[]>; // Section-wise question data
    totalPages: number; // Total number of pages
    pagesVisited: number[]; // Array of visited page numbers
}

export default function Evaluation({ questionData, totalPages, pagesVisited }: EvaluationProps) {
    const [activeSection, setActiveSection] = useState<string>(Object.keys(questionData)[0] || "");
    const { elapsedTime } = useTimerStore();
    const { addOrUpdateMark, marksData } = useMarksStore();
    const [previewQuestionContent, setPreviewQuestionContent] = useState<string>("");
    const pageData = {
        totalPages,
        pagesVisited: new Set(pagesVisited),
        pagesNotVisited: Array.from({ length: totalPages }, (_, i) => i + 1).filter(
            (page) => !pagesVisited.includes(page),
        ),
    };
    const sections = useMemo(() => {
        return Object.entries(questionData).map(([sectionId, questions]) => ({
            sectionId,
            questions: questions.map((question) => {
                const existingMark = marksData.find(
                    (mark) =>
                        mark.section_id === sectionId && mark.question_id === question.question_id,
                );

                return {
                    questionId: question.question_id,
                    questionNo: question.question_order,
                    scoredMarks: existingMark?.marks.toString() || "0",
                    maxMarks: JSON.parse(question.marking_json).data.totalMark,
                    content: question.question.content,
                };
            }),
        }));
    }, [questionData, marksData]);

    const handleScoreChange = (sectionId: string, questionNo: number, value: string) => {
        const section = sections.find((sec) => sec.sectionId === sectionId);
        if (section) {
            const question = section.questions.find((q) => q.questionNo === questionNo);
            if (question && parseFloat(value) > question.maxMarks) {
                window.alert("Scored marks cannot exceed maximum marks.");
                return;
            }
            // Update the store with the new marks
            addOrUpdateMark({
                section_id: sectionId,
                question_id: question?.questionId || "",
                status: "evaluated", // You can adjust this status as needed
                marks: parseFloat(value) || 0,
            });
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    return (
        <div className="max-h-[80%] w-full max-w-80 space-y-2">
            <Tabs>
                <TabsList>
                    {sections.map((section, index) => (
                        <TabsTrigger
                            key={section.sectionId}
                            onClick={() => setActiveSection(section.sectionId)}
                            value={section.sectionId}
                        >
                            Section {index + 1}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {sections.map((section) => (
                    <TabsContent
                        key={section.sectionId}
                        hidden={activeSection !== section.sectionId}
                        value={activeSection}
                    >
                        <ScrollArea className="h-[400px] rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-fit">Question No</TableHead>
                                        <TableHead className="text-center">Scored Marks</TableHead>
                                        <TableHead className="text-center">Max Marks</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {section.questions.map((question) => (
                                        <TableRow key={question.questionNo}>
                                            <TableCell className="flex cursor-pointer items-center space-x-2 text-base font-medium">
                                                <strong>{question.questionNo}</strong>
                                                <ArrowSquareOut
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPreviewQuestionContent(question.content);
                                                    }}
                                                />
                                            </TableCell>

                                            <TableCell className="text-center">
                                                <Input
                                                    type="number"
                                                    value={question.scoredMarks}
                                                    max={String(question.maxMarks)}
                                                    onChange={(e) =>
                                                        handleScoreChange(
                                                            section.sectionId,
                                                            question.questionNo,
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="mx-auto w-fit p-0.5 text-center"
                                                    min={0}
                                                    step="0.5"
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {question.maxMarks}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </TabsContent>
                ))}
            </Tabs>
            <Separator />
            <div className="space-y-4 rounded-md border p-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Pages</span>
                    <span className="font-medium">{pageData.totalPages}</span>
                </div>

                <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Pages visited</div>
                    <div className="rounded bg-muted/50 p-2 text-sm">
                        {Array.from(pageData.pagesVisited).join(", ")}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Pages not visited</div>
                    <div className="rounded bg-muted/50 p-2 text-sm">
                        {pageData.pagesNotVisited.join(", ")}
                    </div>
                </div>
            </div>
            <div className="space-y-4 rounded-md border p-2">
                <div className="flex items-center justify-between">
                    <h2>Evaluation</h2>
                    <span className="text-sm text-muted-foreground">
                        Time Taken: {formatTime(elapsedTime)}
                    </span>
                </div>
            </div>

            <MyDialog
                heading="Preview Question"
                open={!!previewQuestionContent}
                onOpenChange={() => setPreviewQuestionContent("")}
            >
                <strong className="-mt-10">Question :</strong>
                <div
                    className="mb-5 mt-2 text-sm"
                    dangerouslySetInnerHTML={{ __html: previewQuestionContent }}
                />
            </MyDialog>
        </div>
    );
}
