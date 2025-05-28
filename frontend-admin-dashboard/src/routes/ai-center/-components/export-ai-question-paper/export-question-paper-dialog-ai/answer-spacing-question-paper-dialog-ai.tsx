import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Question } from "@/components/common/export-offline/types/question";

interface AnswerSpacingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    questionsData: Question[];
    spacings: { [questionId: string]: number };
    onSave: (spacings: { [questionId: string]: number }) => void;
}

const MIN_SPACING = 10;
const MAX_SPACING = 100;

export function AnswerSpacingQuestionPaperDialogAI({
    open,
    onOpenChange,
    questionsData,
    spacings,
    onSave,
}: AnswerSpacingDialogProps) {
    const [localSpacings, setLocalSpacings] = useState<{ [questionId: string]: number }>(spacings);

    // Reset local spacings when dialog opens
    useEffect(() => {
        if (open) {
            setLocalSpacings(spacings);
        }
    }, [open, spacings]);

    const eligibleQuestions = questionsData.filter(
        (q) =>
            q.question_type === "LONG_ANSWER" ||
            q.question_type === "ONE_WORD" ||
            q.question_type === "NUMERIC",
    );

    const handleSpacingChange = (questionId: string, value: string) => {
        // Allow any value to be typed initially
        const numValue = Number(value);

        setLocalSpacings((prev) => ({
            ...prev,
            [questionId]: numValue,
        }));
    };

    // Add a new function to validate on blur
    const handleBlur = (questionId: string, value: number) => {
        let validValue = value;

        // Only enforce constraints when the field loses focus
        if (value < MIN_SPACING) validValue = MIN_SPACING;
        if (value > MAX_SPACING) validValue = MAX_SPACING;

        setLocalSpacings((prev) => ({
            ...prev,
            [questionId]: validValue,
        }));
    };

    const handleSave = () => {
        onSave(localSpacings);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] min-w-fit overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Manage Answer Spacing</DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 p-3">
                        <p className="text-sm text-blue-700">
                            Specify the space (in mm) to be provided after each question for
                            answers. Valid range is between <strong>{MIN_SPACING}mm</strong> and{" "}
                            <strong>{MAX_SPACING}mm</strong>.
                        </p>
                    </div>

                    <Table>
                        <TableHeader className="bg-primary-100">
                            <TableRow>
                                <TableHead className="w-[80px]">Q.No.</TableHead>
                                <TableHead className="w-[120px]">Section</TableHead>
                                <TableHead className="w-2/5">Question</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="w-[120px]">Space (mm)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="bg-neutral-50">
                            {eligibleQuestions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-4 text-center">
                                        No eligible questions found. Only long answer and one-word
                                        questions can have custom spacing.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                eligibleQuestions.map((question, idx) => (
                                    <TableRow key={question.question_id}>
                                        <TableCell>{idx + 1}</TableCell>
                                        <TableCell className="max-w-[300px] overflow-hidden">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="cursor-help">
                                                            <div
                                                                className="line-clamp-2 text-sm"
                                                                dangerouslySetInnerHTML={{
                                                                    __html:
                                                                        question.question.content ||
                                                                        "",
                                                                }}
                                                            />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side="bottom"
                                                        className="max-h-[300px] w-[400px] overflow-y-auto"
                                                    >
                                                        <div
                                                            className="text-sm"
                                                            dangerouslySetInnerHTML={{
                                                                __html:
                                                                    question.question.content || "",
                                                            }}
                                                        />
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </TableCell>
                                        <TableCell>
                                            {question.question_type === "LONG_ANSWER"
                                                ? "Long Answer"
                                                : "One Word"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center">
                                                <Input
                                                    type="number"
                                                    max={MAX_SPACING}
                                                    className="w-20"
                                                    value={localSpacings[question.question_id]}
                                                    onChange={(e) =>
                                                        handleSpacingChange(
                                                            question.question_id,
                                                            e.target.value,
                                                        )
                                                    }
                                                    onBlur={(e) =>
                                                        handleBlur(
                                                            question.question_id,
                                                            Number(e.target.value),
                                                        )
                                                    }
                                                />
                                                <span className="ml-1 text-xs text-gray-500">
                                                    mm
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        className="bg-primary-500 text-white hover:bg-primary-400"
                        onClick={handleSave}
                    >
                        Save Settings
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
