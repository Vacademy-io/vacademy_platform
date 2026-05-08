import { useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { FileCsv, FileXls, DownloadSimple, UploadSimple, X } from '@phosphor-icons/react';
import { UploadQuestionPaperFormType } from '@/routes/assessment/question-papers/-components/QuestionPaperUpload';
import * as XLSX from 'xlsx';

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

const EXCEL_TEMPLATE_HEADERS = [
    'question_text',
    'question_type',
    'option_a',
    'option_b',
    'option_c',
    'option_d',
    'correct_answer',
    'explanation',
];

const EXCEL_TEMPLATE_DATA = [
    ['What is 2 + 2?', 'MCQS', '1', '2', '4', '8', 'C', '2 + 2 equals 4 by basic arithmetic.'],
    ['Is the Earth flat?', 'TRUE_FALSE', 'True', 'False', '', '', 'B', 'The Earth is an oblate spheroid.'],
    ['Which planet is closest to the Sun?', 'MCQS', 'Venus', 'Mercury', 'Mars', 'Earth', 'B', 'Mercury is the closest planet to the Sun.'],
];

const OPTION_HEADER_REGEX = /^option_([a-z])$/;

interface ParseError {
    row: number;
    message: string;
}

const QuizAddViaCSVDialog = ({ open, onOpenChange, onQuestionsReady }: QuizAddViaCSVDialogProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
    const [parsedCount, setParsedCount] = useState<number | null>(null);

    const handleDownloadCSVTemplate = () => {
        const content = [CSV_TEMPLATE_HEADER, ...CSV_SAMPLE_ROWS].join('\n');
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'quiz_questions_template.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadExcelTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([EXCEL_TEMPLATE_HEADERS, ...EXCEL_TEMPLATE_DATA]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Questions');
        XLSX.writeFile(wb, 'quiz_questions_template.xlsx');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setParseErrors([]);
            setParsedCount(null);
        }
    };

    const isExcelFile = (file: File): boolean => {
        return file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    };

    const parseExcel = async (file: File): Promise<string[][]> => {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]!]!;
        const rows: string[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
        return rows.map((row) => row.map((cell) => String(cell).trim()));
    };

    const parseCSVText = (text: string): string[][] => {
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        return lines.map((line) => line.split(',').map((col) => col.trim()));
    };

    const parseRows = (rows: string[][]): { questions: UploadQuestionPaperFormType['questions']; errors: ParseError[] } => {
        const questions: UploadQuestionPaperFormType['questions'] = [];
        const errors: ParseError[] = [];

        if (rows.length === 0) {
            return { questions, errors: [{ row: 0, message: 'File is empty.' }] };
        }

        const headerRow = rows[0]!.map((h) => h.trim().toLowerCase());
        const headerIndex: Record<string, number> = {};
        headerRow.forEach((h, i) => {
            if (h && headerIndex[h] === undefined) headerIndex[h] = i;
        });

        const qTextIdx = headerIndex['question_text'];
        const qTypeIdx = headerIndex['question_type'];
        const correctIdx = headerIndex['correct_answer'];
        const explIdx = headerIndex['explanation'];

        const missing: string[] = [];
        if (qTextIdx === undefined) missing.push('question_text');
        if (qTypeIdx === undefined) missing.push('question_type');
        if (correctIdx === undefined) missing.push('correct_answer');
        if (missing.length > 0) {
            return {
                questions,
                errors: [{ row: 1, message: `Missing required column(s): ${missing.join(', ')}.` }],
            };
        }

        const optionColumns: { letter: string; index: number }[] = [];
        headerRow.forEach((h, i) => {
            const m = h.match(OPTION_HEADER_REGEX);
            if (m) optionColumns.push({ letter: m[1]!.toUpperCase(), index: i });
        });
        optionColumns.sort((a, b) => a.letter.localeCompare(b.letter));

        if (optionColumns.length === 0) {
            return {
                questions,
                errors: [{ row: 1, message: 'No option columns found. Add option_a, option_b, ... at minimum.' }],
            };
        }

        const validLetters = optionColumns.map((c) => c.letter);
        const correctAnswerMap: Record<string, number> = {};
        validLetters.forEach((letter, i) => {
            correctAnswerMap[letter] = i;
        });

        for (let i = 1; i < rows.length; i++) {
            const rowNum = i + 1; // 1-based for display
            const cols = rows[i]!;

            // Skip fully empty rows
            if (cols.every((c) => !c)) continue;

            const questionText = (cols[qTextIdx!] || '').trim();
            const questionType = (cols[qTypeIdx!] || '').trim().toUpperCase();
            const correctAnswerRaw = (cols[correctIdx!] || '').trim();
            const correctAnswer = correctAnswerRaw.toUpperCase();
            const explanation = explIdx !== undefined ? (cols[explIdx] || '').trim() : '';

            if (!questionText) {
                errors.push({ row: rowNum, message: 'question_text is empty.' });
                continue;
            }

            if (questionType !== 'MCQS' && questionType !== 'TRUE_FALSE') {
                errors.push({
                    row: rowNum,
                    message: `Unsupported question_type "${(cols[qTypeIdx!] || '').trim()}". Only MCQS and TRUE_FALSE are allowed.`,
                });
                continue;
            }

            if (questionType === 'MCQS') {
                const answerIndex = correctAnswerMap[correctAnswer];
                if (answerIndex === undefined) {
                    errors.push({
                        row: rowNum,
                        message: `Invalid correct_answer "${correctAnswerRaw}". Use ${validLetters.join(', ')}.`,
                    });
                    continue;
                }

                const rawOptions = optionColumns.map((c) => (cols[c.index] || '').trim());

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

                const filteredAnswerIndex = options.findIndex((opt) => opt.isSelected);

                questions.push({
                    questionName: questionText,
                    questionType: 'MCQS',
                    questionMark: '1',
                    questionPenalty: '0',
                    questionDuration: { hrs: '0', min: '0' },
                    explanation,
                    tags: [],
                    canSkip: false,
                    validAnswers: [filteredAnswerIndex >= 0 ? filteredAnswerIndex : answerIndex],
                    parentRichTextContent: '',
                    subjectiveAnswerText: '',
                    decimals: 0,
                    numericType: '',
                    singleChoiceOptions: options,
                });
            } else {
                // TRUE_FALSE
                if (correctAnswer !== 'A' && correctAnswer !== 'B') {
                    errors.push({
                        row: rowNum,
                        message: `Invalid correct_answer "${correctAnswerRaw}" for TRUE_FALSE. Use A (True) or B (False).`,
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

        let rows: string[][];

        if (isExcelFile(selectedFile)) {
            rows = await parseExcel(selectedFile);
        } else {
            const text = await selectedFile.text();
            rows = parseCSVText(text);
        }

        const { questions, errors } = parseRows(rows);
        setParseErrors(errors);
        setParsedCount(questions.length);

        if (questions.length > 0) {
            onQuestionsReady(questions);
            if (errors.length === 0) {
                handleReset();
                onOpenChange(false);
            }
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
                    <h1 className="font-semibold text-primary-500">Upload Questions</h1>
                    <button
                        type="button"
                        className="text-neutral-500 hover:text-neutral-700"
                        onClick={() => onOpenChange(false)}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex flex-col gap-5 p-5">
                    {/* Template downloads */}
                    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                        <div>
                            <p className="text-sm font-medium text-neutral-700">Download Template</p>
                            <p className="text-xs text-neutral-500">
                                Supports MCQS and TRUE_FALSE question types
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="default"
                                onClick={handleDownloadCSVTemplate}
                            >
                                <DownloadSimple size={14} />
                                CSV
                            </MyButton>
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                layoutVariant="default"
                                onClick={handleDownloadExcelTemplate}
                            >
                                <DownloadSimple size={14} />
                                Excel
                            </MyButton>
                        </div>
                    </div>

                    {/* Column reference */}
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
                        <p className="mb-1 font-medium">Columns:</p>
                        <code className="block text-neutral-500">
                            question_text, question_type, option_a, option_b, option_c, option_d,
                            correct_answer, explanation
                        </code>
                        <p className="mt-2 text-neutral-400">
                            For MCQS, add more options as needed (option_e, option_f, ...) — correct_answer must match an option letter (A, B, C, ...). For TRUE_FALSE, use A (True) or B (False).
                        </p>
                    </div>

                    {/* File drop zone */}
                    <div
                        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 transition-colors hover:border-primary-400 hover:bg-primary-50"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="flex gap-2">
                            <FileCsv size={36} className="text-primary-400" />
                            <FileXls size={36} className="text-green-500" />
                        </div>
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
                                    Click to select a file
                                </p>
                                <p className="text-xs text-neutral-400">.csv, .xlsx, or .xls files are supported</p>
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>

                    {/* Parse summary */}
                    {parsedCount !== null && parsedCount > 0 && parseErrors.length > 0 && (
                        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2">
                            <p className="text-sm font-medium text-yellow-700">
                                {parsedCount} question(s) added successfully, {parseErrors.length} row(s) skipped.
                            </p>
                        </div>
                    )}

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
