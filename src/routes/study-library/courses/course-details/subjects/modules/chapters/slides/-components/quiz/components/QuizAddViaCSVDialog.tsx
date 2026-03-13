import { useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { FileCsv, DownloadSimple, UploadSimple, X } from '@phosphor-icons/react';
import { UploadQuestionPaperFormType } from '@/routes/assessment/question-papers/-components/QuestionPaperUpload';

interface QuizAddViaCSVDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onQuestionsReady: (questions: UploadQuestionPaperFormType['questions']) => void;
}

const CSV_TEMPLATE_HEADER =
    'question_text,question_type,option_a,option_b,option_c,option_d,correct_answer,explanation';

const CSV_SAMPLE_ROWS = [
    'What is 2 + 2?,MCQS,1,2,4,8,C,2 + 2 equals 4 by basic arithmetic.',
    'Is the Earth flat?,TRUE_FALSE,True,False,,,B,The Earth is an oblate spheroid.',
    'Which planet is closest to the Sun?,MCQS,Venus,Mercury,Mars,Earth,B,Mercury is the closest planet to the Sun.',
];

const CORRECT_ANSWER_MAP: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

interface ParseError {
    row: number;
    message: string;
}

const QuizAddViaCSVDialog = ({ open, onOpenChange, onQuestionsReady }: QuizAddViaCSVDialogProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
    const [parsedCount, setParsedCount] = useState<number | null>(null);

    const handleDownloadTemplate = () => {
        const content = [CSV_TEMPLATE_HEADER, ...CSV_SAMPLE_ROWS].join('\n');
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'quiz_questions_template.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setParseErrors([]);
            setParsedCount(null);
        }
    };

    const parseCSV = (text: string): { questions: UploadQuestionPaperFormType['questions']; errors: ParseError[] } => {
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        const questions: UploadQuestionPaperFormType['questions'] = [];
        const errors: ParseError[] = [];

        // Skip header row (index 0)
        for (let i = 1; i < lines.length; i++) {
            const rowNum = i + 1; // 1-based for display
            const line = lines[i];
            if (!line) continue;
            // Simple CSV split — handles basic cases; doesn't handle quoted commas
            const cols = line.split(',');

            if (cols.length < 7) {
                errors.push({ row: rowNum, message: 'Not enough columns (need at least 7).' });
                continue;
            }

            const questionText = (cols[0] || '').trim();
            const questionType = (cols[1] || '').trim().toUpperCase();
            const optA = (cols[2] || '').trim();
            const optB = (cols[3] || '').trim();
            const optC = (cols[4] || '').trim();
            const optD = (cols[5] || '').trim();
            const correctAnswer = (cols[6] || '').trim().toUpperCase();
            const explanation = cols.slice(7).join(',').trim(); // rest of line is explanation

            if (!questionText) {
                errors.push({ row: rowNum, message: 'question_text is empty.' });
                continue;
            }

            if (questionType !== 'MCQS' && questionType !== 'TRUE_FALSE') {
                errors.push({
                    row: rowNum,
                    message: `Unsupported question_type "${(cols[1] || '').trim()}". Only MCQS and TRUE_FALSE are allowed.`,
                });
                continue;
            }

            if (questionType === 'MCQS') {
                const answerIndex = CORRECT_ANSWER_MAP[correctAnswer];
                if (answerIndex === undefined) {
                    errors.push({
                        row: rowNum,
                        message: `Invalid correct_answer "${(cols[6] || '').trim()}". Use A, B, C, or D.`,
                    });
                    continue;
                }

                const rawOptions = [optA, optB, optC, optD];

                // Validate the correct answer option is not empty
                if (!rawOptions[answerIndex]) {
                    errors.push({
                        row: rowNum,
                        message: `correct_answer is "${correctAnswer}" but option_${correctAnswer.toLowerCase()} is empty.`,
                    });
                    continue;
                }

                const options = rawOptions
                    .map((name, i) => ({ id: '', name, isSelected: i === answerIndex }))
                    .filter((opt) => opt.name !== '');

                if (options.length < 2) {
                    errors.push({ row: rowNum, message: 'MCQS requires at least 2 options (option_a and option_b).' });
                    continue;
                }

                questions.push({
                    questionName: questionText,
                    questionType: 'MCQS',
                    questionMark: '1',
                    questionPenalty: '0',
                    questionDuration: { hrs: '0', min: '0' },
                    explanation,
                    tags: [],
                    canSkip: false,
                    validAnswers: [answerIndex],
                    parentRichTextContent: '',
                    subjectiveAnswerText: '',
                    decimals: 0,
                    numericType: '',
                    singleChoiceOptions: options,
                    multipleChoiceOptions: Array(4).fill({ id: '', name: '', isSelected: false }),
                    csingleChoiceOptions: Array(4).fill({ id: '', name: '', isSelected: false }),
                    cmultipleChoiceOptions: Array(4).fill({ id: '', name: '', isSelected: false }),
                    trueFalseOptions: [
                        { id: '', name: 'True', isSelected: false },
                        { id: '', name: 'False', isSelected: false },
                    ],
                });
            } else {
                // TRUE_FALSE
                if (correctAnswer !== 'A' && correctAnswer !== 'B') {
                    errors.push({
                        row: rowNum,
                        message: `Invalid correct_answer "${(cols[6] || '').trim()}" for TRUE_FALSE. Use A (True) or B (False).`,
                    });
                    continue;
                }
                const isTrue = correctAnswer === 'A';
                questions.push({
                    questionName: questionText,
                    questionType: 'TRUE_FALSE',
                    questionMark: '1',
                    questionPenalty: '0',
                    questionDuration: { hrs: '0', min: '0' },
                    explanation,
                    tags: [],
                    canSkip: false,
                    validAnswers: [isTrue ? 0 : 1],
                    parentRichTextContent: '',
                    subjectiveAnswerText: '',
                    decimals: 0,
                    numericType: '',
                    singleChoiceOptions: Array(4).fill({ id: '', name: '', isSelected: false }),
                    multipleChoiceOptions: Array(4).fill({ id: '', name: '', isSelected: false }),
                    csingleChoiceOptions: Array(4).fill({ id: '', name: '', isSelected: false }),
                    cmultipleChoiceOptions: Array(4).fill({ id: '', name: '', isSelected: false }),
                    trueFalseOptions: [
                        { id: '', name: 'True', isSelected: isTrue },
                        { id: '', name: 'False', isSelected: !isTrue },
                    ],
                });
            }
        }

        return { questions, errors };
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        const text = await selectedFile.text();
        const { questions, errors } = parseCSV(text);
        setParseErrors(errors);
        setParsedCount(questions.length);

        if (questions.length > 0) {
            onQuestionsReady(questions);
            handleReset();
            onOpenChange(false);
        }
    };

    const handleReset = () => {
        setSelectedFile(null);
        setParseErrors([]);
        setParsedCount(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = (nextOpen: boolean) => {
        if (!nextOpen) handleReset();
        onOpenChange(nextOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="no-scrollbar !m-0 flex h-auto !w-full !max-w-lg flex-col !gap-0 overflow-y-auto !rounded-lg !p-0">
                {/* Header */}
                <div className="flex items-center justify-between bg-primary-50 px-5 py-4">
                    <h1 className="font-semibold text-primary-500">Upload CSV</h1>
                    <button
                        type="button"
                        className="text-neutral-500 hover:text-neutral-700"
                        onClick={() => onOpenChange(false)}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex flex-col gap-5 p-5">
                    {/* Template download */}
                    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                        <div>
                            <p className="text-sm font-medium text-neutral-700">CSV Template</p>
                            <p className="text-xs text-neutral-500">
                                Supports MCQS and TRUE_FALSE question types
                            </p>
                        </div>
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            layoutVariant="default"
                            onClick={handleDownloadTemplate}
                        >
                            <DownloadSimple size={14} />
                            Download
                        </MyButton>
                    </div>

                    {/* CSV column reference */}
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
                        <p className="mb-1 font-medium">Columns:</p>
                        <code className="block text-neutral-500">
                            question_text, question_type, option_a, option_b, option_c, option_d,
                            correct_answer, explanation
                        </code>
                        <p className="mt-2 text-neutral-400">
                            correct_answer: A/B/C/D for MCQS · A (True) or B (False) for TRUE_FALSE
                        </p>
                    </div>

                    {/* File drop zone */}
                    <div
                        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 transition-colors hover:border-primary-400 hover:bg-primary-50"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <FileCsv size={40} className="text-primary-400" />
                        {selectedFile ? (
                            <div className="text-center">
                                <p className="text-sm font-medium text-primary-600">
                                    {selectedFile.name}
                                </p>
                                <p className="text-xs text-neutral-500">
                                    {(selectedFile.size / 1024).toFixed(1)} KB
                                </p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-sm font-medium text-neutral-700">
                                    Click to select a CSV file
                                </p>
                                <p className="text-xs text-neutral-400">Only .csv files are supported</p>
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>

                    {/* Parse errors */}
                    {parseErrors.length > 0 && (
                        <div className="max-h-40 overflow-y-auto rounded-md border border-red-200 bg-red-50 px-3 py-2">
                            <p className="mb-1 text-sm font-medium text-red-700">
                                Parse errors ({parseErrors.length}):
                            </p>
                            {parseErrors.map((err, i) => (
                                <p key={i} className="text-xs text-red-600">
                                    Row {err.row}: {err.message}
                                </p>
                            ))}
                            {parsedCount !== null && parsedCount === 0 && (
                                <p className="mt-1 text-xs font-medium text-red-700">
                                    No valid questions found. Fix the errors and try again.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-neutral-200 px-5 py-4">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="medium"
                        layoutVariant="default"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="medium"
                        layoutVariant="default"
                        onClick={handleUpload}
                        disabled={!selectedFile}
                    >
                        <UploadSimple size={16} />
                        Parse & Preview
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default QuizAddViaCSVDialog;
