/**
 * End-to-end coverage for the quiz CSV/Excel upload path.
 *
 * Drives the real dialog (file input → Parse & Preview) and then feeds the questions it
 * produces into the real payload builder, so the whole chain is exercised:
 *
 *   file → parseCSVText/parseExcel → parseRows → onQuestionsReady
 *        → createQuizSlidePayload → backend question_type / options / auto_evaluation_json
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import * as XLSX from 'xlsx';
import QuizAddViaCSVDialog from '../QuizAddViaCSVDialog';
import QuizQuestionsPreviewDialog from '../QuizQuestionsPreviewDialog';
import { createQuizSlidePayload } from '../../utils/api-helpers';
import { Slide } from '../../types';

type ParsedQuestions = Parameters<
    React.ComponentProps<typeof QuizAddViaCSVDialog>['onQuestionsReady']
>[0];

const HEADER =
    'question_text,question_type,option_a,option_b,option_c,option_d,correct_answer,explanation';

const uploadFile = async (file: File) => {
    const onQuestionsReady = vi.fn();
    render(
        <QuizAddViaCSVDialog open onOpenChange={() => {}} onQuestionsReady={onQuestionsReady} />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /Parse & Preview/i }));

    // Parsing is async (file.text() / file.arrayBuffer()); wait for either outcome to land.
    await waitFor(() => {
        expect(
            onQuestionsReady.mock.calls.length > 0 ||
                document.body.textContent?.includes('Parse errors')
        ).toBe(true);
    });

    const questions: ParsedQuestions = onQuestionsReady.mock.calls[0]?.[0] ?? [];
    const errorText = document.body.textContent ?? '';
    return { questions, errorText, onQuestionsReady };
};

const uploadCSV = (rows: string[], name = 'quiz.csv') =>
    uploadFile(new File([[HEADER, ...rows].join('\n')], name, { type: 'text/csv' }));

const selected = (opts?: Array<{ name?: string; isSelected?: boolean }>) =>
    (opts ?? []).filter((o) => o.isSelected).map((o) => o.name ?? '');

afterEach(cleanup);

describe('QuizAddViaCSVDialog — multi-correct (MCQM) support', () => {
    it('imports a quoted multi-answer cell as MCQM with both options selected', async () => {
        const { questions, errorText } = await uploadCSV([
            'Which of these are prime numbers?,MCQM,2,3,4,6,"A,B",Both 2 and 3 are prime.',
        ]);

        expect(errorText).not.toContain('Parse errors');
        expect(questions).toHaveLength(1);
        expect(questions[0]!.questionType).toBe('MCQM');
        expect(questions[0]!.multipleChoiceOptions).toHaveLength(4);
        expect(selected(questions[0]!.multipleChoiceOptions)).toEqual(['2', '3']);
        expect(questions[0]!.validAnswers).toEqual([0, 1]);
        expect(questions[0]!.singleChoiceOptions).toBeUndefined();
    });

    it('upgrades a row declared MCQS to MCQM when several answers are listed', async () => {
        const { questions } = await uploadCSV([
            'Which are even?,MCQS,1,2,3,4,"B,D",2 and 4 are even.',
        ]);

        expect(questions[0]!.questionType).toBe('MCQM');
        expect(selected(questions[0]!.multipleChoiceOptions)).toEqual(['2', '4']);
        expect(questions[0]!.validAnswers).toEqual([1, 3]);
    });

    it('infers the type when question_type is left blank', async () => {
        const { questions } = await uploadCSV([
            'Which are primary colours?,,Red,Green,Blue,Orange,"A,B,C","Red, green and blue are primary."',
            'Which is a fruit?,,Carrot,Apple,Onion,Potato,B,Apple is a fruit.',
        ]);

        expect(questions[0]!.questionType).toBe('MCQM');
        expect(selected(questions[0]!.multipleChoiceOptions)).toEqual(['Red', 'Green', 'Blue']);
        // The quoted explanation contains a comma — it must not bleed into the next column.
        expect(questions[0]!.explanation).toBe('Red, green and blue are primary.');

        expect(questions[1]!.questionType).toBe('MCQS');
        expect(selected(questions[1]!.singleChoiceOptions)).toEqual(['Apple']);
    });

    it('accepts ; | / and space as answer separators', async () => {
        const { questions } = await uploadCSV([
            'Semicolon?,,W,X,Y,Z,B;D,semi',
            'Pipe?,,W,X,Y,Z,A|C,pipe',
            'Slash?,,W,X,Y,Z,A/D,slash',
            'Space?,,W,X,Y,Z,B C,space',
        ]);

        expect(questions.map((q) => q.questionType)).toEqual(['MCQM', 'MCQM', 'MCQM', 'MCQM']);
        expect(questions.map((q) => q.validAnswers)).toEqual([
            [1, 3],
            [0, 2],
            [0, 3],
            [1, 2],
        ]);
    });

    it('recovers an unquoted multi-answer cell written by hand', async () => {
        const { questions, errorText } = await uploadCSV([
            'Unquoted?,MCQS,P,Q,R,S,A,C,Answers were not quoted',
        ]);

        expect(errorText).not.toContain('Parse errors');
        expect(questions[0]!.questionType).toBe('MCQM');
        expect(selected(questions[0]!.multipleChoiceOptions)).toEqual(['P', 'R']);
        expect(questions[0]!.explanation).toBe('Answers were not quoted');
    });

    it('de-duplicates repeated letters and ignores answer order', async () => {
        const { questions } = await uploadCSV(['Dupes?,MCQM,P,Q,R,S,"C,A,C",dupes']);

        expect(questions[0]!.validAnswers).toEqual([0, 2]);
        expect(selected(questions[0]!.multipleChoiceOptions)).toEqual(['P', 'R']);
    });

    it('re-indexes answers after empty option columns are dropped', async () => {
        // option_b is empty, so the surviving options are [P, R, S] and D becomes index 2.
        const { questions } = await uploadCSV(['Gap?,MCQM,P,,R,S,"A,D",gap']);

        expect(questions[0]!.multipleChoiceOptions?.map((o) => o.name)).toEqual(['P', 'R', 'S']);
        expect(questions[0]!.validAnswers).toEqual([0, 2]);
        expect(selected(questions[0]!.multipleChoiceOptions)).toEqual(['P', 'S']);
    });

    it('supports more than four options via option_e / option_f', async () => {
        const onQuestionsReady = vi.fn();
        render(
            <QuizAddViaCSVDialog open onOpenChange={() => {}} onQuestionsReady={onQuestionsReady} />
        );
        const csv = [
            `${HEADER.replace(',correct_answer', ',option_e,option_f,correct_answer')}`,
            'Six options?,,A1,B1,C1,D1,E1,F1,"B,F",two picked',
        ].join('\n');
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(input, {
            target: { files: [new File([csv], 'six.csv', { type: 'text/csv' })] },
        });
        fireEvent.click(screen.getByRole('button', { name: /Parse & Preview/i }));

        await waitFor(() => expect(onQuestionsReady).toHaveBeenCalled());
        const q = onQuestionsReady.mock.calls[0]![0][0];
        expect(q.questionType).toBe('MCQM');
        expect(q.multipleChoiceOptions).toHaveLength(6);
        expect(selected(q.multipleChoiceOptions)).toEqual(['B1', 'F1']);
        expect(q.validAnswers).toEqual([1, 5]);
    });
});

describe('QuizAddViaCSVDialog — existing behaviour still intact', () => {
    it('keeps single-answer MCQS on singleChoiceOptions', async () => {
        const { questions } = await uploadCSV([
            'What is 2 + 2?,MCQS,1,2,4,8,C,2 + 2 equals 4 by basic arithmetic.',
        ]);

        expect(questions[0]!.questionType).toBe('MCQS');
        expect(selected(questions[0]!.singleChoiceOptions)).toEqual(['4']);
        expect(questions[0]!.validAnswers).toEqual([2]);
        expect(questions[0]!.multipleChoiceOptions).toBeUndefined();
    });

    it('imports TRUE_FALSE unchanged', async () => {
        const { questions } = await uploadCSV([
            'Is the Earth flat?,TRUE_FALSE,True,False,,,B,Oblate spheroid.',
        ]);

        expect(questions[0]!.questionType).toBe('TRUE_FALSE');
        expect(questions[0]!.validAnswers).toEqual([1]);
        expect(selected(questions[0]!.trueFalseOptions)).toEqual(['False']);
    });

    it('handles CRLF line endings', async () => {
        const file = new File(
            [[HEADER, 'CRLF?,MCQM,P,Q,R,S,"A,B",crlf'].join('\r\n')],
            'crlf.csv',
            { type: 'text/csv' }
        );
        const { questions } = await uploadFile(file);

        expect(questions[0]!.questionType).toBe('MCQM');
        expect(questions[0]!.explanation).toBe('crlf');
    });

    it('parses a UTF-8 BOM header (Excel "Save as CSV" output)', async () => {
        const file = new File(
            ['﻿' + [HEADER, 'BOM?,MCQM,P,Q,R,S,"A,B",bom'].join('\n')],
            'bom.csv',
            { type: 'text/csv' }
        );
        const { questions, errorText } = await uploadFile(file);

        expect(errorText).not.toContain('Missing required column');
        expect(questions[0]!.questionType).toBe('MCQM');
    });
});

describe('QuizAddViaCSVDialog — validation', () => {
    it('rejects an answer letter with no matching option column', async () => {
        const { questions, errorText } = await uploadCSV(['Bad letter?,MCQM,P,Q,R,S,"A,Z",bad']);

        expect(questions).toHaveLength(0);
        expect(errorText).toContain('Invalid correct_answer "A,Z"');
    });

    it('rejects a multi-answer row pointing at an empty option column', async () => {
        const { questions, errorText } = await uploadCSV(['Empty opt?,MCQM,P,Q,,,"A,C",bad']);

        expect(questions).toHaveLength(0);
        expect(errorText).toContain('correct_answer references C but option_c is empty.');
    });

    it('rejects TRUE_FALSE with several answers instead of silently upgrading', async () => {
        const { questions, errorText } = await uploadCSV([
            'Both?,TRUE_FALSE,True,False,,,"A,B",nope',
        ]);

        expect(questions).toHaveLength(0);
        expect(errorText).toContain('Invalid correct_answer "A,B" for TRUE_FALSE');
    });

    it('rejects an unsupported question_type and names MCQM as allowed', async () => {
        const { questions, errorText } = await uploadCSV(['Essay?,LONG_ANSWER,P,Q,R,S,A,nope']);

        expect(questions).toHaveLength(0);
        expect(errorText).toContain('Only MCQS, MCQM and TRUE_FALSE are allowed.');
    });

    it('rejects a multi-answer row left with fewer than two options', async () => {
        const { questions, errorText } = await uploadCSV(['Solo?,MCQM,P,,,,A,only one option']);

        expect(questions).toHaveLength(0);
        expect(errorText).toContain('requires at least 2 options');
    });

    it('imports the good rows and reports only the bad ones', async () => {
        const { questions, errorText } = await uploadCSV([
            'Good?,MCQM,P,Q,R,S,"A,B",ok',
            'Bad?,MCQM,P,Q,R,S,"A,Z",bad',
            'Also good?,,P,Q,R,S,C,ok',
        ]);

        expect(questions.map((q) => q.questionType)).toEqual(['MCQM', 'MCQS']);
        expect(errorText).toContain('Row 3');
        expect(errorText).toContain('2 question(s) added successfully, 1 row(s) skipped.');
    });
});

describe('QuizAddViaCSVDialog — Excel upload', () => {
    it('reads a multi-answer cell from .xlsx without quoting', async () => {
        const ws = XLSX.utils.aoa_to_sheet([
            HEADER.split(','),
            ['Which are prime?', 'MCQM', '2', '3', '4', '6', 'A,B', 'Both are prime.'],
            ['Blank type?', '', 'W', 'X', 'Y', 'Z', 'B,D', 'inferred'],
            ['Single?', 'MCQS', 'W', 'X', 'Y', 'Z', 'C', 'one answer'],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Questions');
        const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

        const { questions, errorText } = await uploadFile(
            new File([buffer], 'quiz.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
        );

        expect(errorText).not.toContain('Parse errors');
        expect(questions.map((q) => q.questionType)).toEqual(['MCQM', 'MCQM', 'MCQS']);
        expect(selected(questions[0]!.multipleChoiceOptions)).toEqual(['2', '3']);
        expect(selected(questions[1]!.multipleChoiceOptions)).toEqual(['X', 'Z']);
        expect(selected(questions[2]!.singleChoiceOptions)).toEqual(['Y']);
    });
});

describe('Downloaded template round-trips through the uploader', () => {
    it('re-uploading the CSV template yields every sample question with no errors', async () => {
        // Capture the blob the download button hands to URL.createObjectURL, then feed it back in.
        const blobs: Blob[] = [];
        const createObjectURL = vi
            .spyOn(URL, 'createObjectURL')
            .mockImplementation((blob: Blob | MediaSource) => {
                blobs.push(blob as Blob);
                return 'blob:mock';
            });
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        const { unmount } = render(
            <QuizAddViaCSVDialog open onOpenChange={() => {}} onQuestionsReady={() => {}} />
        );
        fireEvent.click(screen.getByRole('button', { name: /^CSV$/i }));
        expect(createObjectURL).toHaveBeenCalled();
        const templateText = await blobs[0]!.text();
        unmount();
        cleanup();

        const { questions, errorText } = await uploadFile(
            new File([templateText], 'template.csv', { type: 'text/csv' })
        );

        expect(errorText).not.toContain('Parse errors');
        expect(questions).toHaveLength(5);
        expect(questions.map((q) => q.questionType)).toEqual([
            'MCQS',
            'TRUE_FALSE',
            'MCQS',
            'MCQM',
            'MCQM',
        ]);
        expect(questions[4]!.explanation).toBe('Red, green and blue are all primary colours.');
        vi.restoreAllMocks();
    });
});

describe('Parsed MCQM questions render in the confirmation preview', () => {
    it('marks every correct option and confirms them unchanged', async () => {
        const { questions } = await uploadCSV([
            'Which of these are prime numbers?,MCQM,2,3,4,6,"A,B",Both 2 and 3 are prime.',
        ]);
        cleanup();

        const onConfirm = vi.fn();
        render(
            <QuizQuestionsPreviewDialog
                open
                onOpenChange={() => {}}
                questions={questions}
                onConfirm={onConfirm}
            />
        );

        expect(screen.getByText('MCQM')).toBeTruthy();
        expect(screen.getAllByText('✓ Correct')).toHaveLength(2);
        // Plural label is what tells the admin the question accepts several answers.
        expect(screen.getByText('Correct Answers:')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /Add 1 Question/i }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm.mock.calls[0]![0][0].questionType).toBe('MCQM');
        expect(selected(onConfirm.mock.calls[0]![0][0].multipleChoiceOptions)).toEqual(['2', '3']);
    });
});

describe('Parsed MCQM questions survive the backend payload build', () => {
    const activeItem = {
        id: 'slide-1',
        source_id: 'src-1',
        source_type: 'QUIZ',
        title: 'Quiz',
        image_file_id: '',
        description: '',
        status: 'DRAFT',
        slide_order: 0,
        is_loaded: true,
        new_slide: false,
        quiz_slide: null,
    } as unknown as Slide;

    it('sends question_type MCQM with correctAnswers pointing at the selected option ids', async () => {
        const { questions } = await uploadCSV([
            'Which are prime?,MCQM,2,3,4,6,"A,B",Both are prime.',
            'What is 2 + 2?,MCQS,1,2,4,8,C,basic arithmetic.',
        ]);

        // QuizPreview stamps stable ids before building the payload; mirror that here.
        const withIds = questions.map((q) => ({
            ...q,
            id: crypto.randomUUID(),
            multipleChoiceOptions: q.multipleChoiceOptions?.map((o) => ({
                ...o,
                id: crypto.randomUUID(),
            })),
            singleChoiceOptions: q.singleChoiceOptions?.map((o) => ({
                ...o,
                id: crypto.randomUUID(),
            })),
        }));

        const payload = createQuizSlidePayload(withIds, activeItem);
        const [mcqm, mcqs] = payload.quiz_slide.questions;

        expect(mcqm!.question_type).toBe('MCQM');
        expect(mcqm!.question_response_type).toBe('OPTION');
        expect(mcqm!.evaluation_type).toBe('AUTO');
        expect(mcqm!.options.map((o: { text: { content: string } }) => o.text.content)).toEqual([
            '2',
            '3',
            '4',
            '6',
        ]);
        // Correct answers are stored as option IDs — the first two options here.
        expect(JSON.parse(mcqm!.auto_evaluation_json)).toEqual({
            correctAnswers: [mcqm!.options[0]!.id, mcqm!.options[1]!.id],
        });

        expect(mcqs!.question_type).toBe('MCQS');
        expect(JSON.parse(mcqs!.auto_evaluation_json)).toEqual({
            correctAnswers: [mcqs!.options[2]!.id],
        });
    });
});
