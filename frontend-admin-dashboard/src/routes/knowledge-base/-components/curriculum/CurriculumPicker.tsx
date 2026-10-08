import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpenText } from '@phosphor-icons/react';
import { MyDropdown } from '@/components/design-system/dropdown';
import { cn } from '@/lib/utils';
import type { KnowledgeBase } from '../../-types';
import { boardsOf, booksOf, classLabel, classesOf, subjectsOf } from './curriculum';

interface CurriculumPickerProps {
    /** Curriculum knowledge bases only (see curriculumOnly). */
    knowledgeBases: KnowledgeBase[];
    onPick: (kb: KnowledgeBase) => void;
    className?: string;
}

/**
 * Board → Class → Subject, then the book if a subject has more than one.
 *
 * Deliberately three dropdowns and nothing else: a teacher building a Class 11
 * Chemistry test should not have to know what a "knowledge base" is. When the
 * choice is unambiguous (one book for that subject) it is picked immediately.
 */
export const CurriculumPicker = ({ knowledgeBases, onPick, className }: CurriculumPickerProps) => {
    const { t } = useTranslation('knowledgeBaseCurriculum');

    const boards = useMemo(() => boardsOf(knowledgeBases), [knowledgeBases]);
    const [board, setBoard] = useState<string>('');
    const [cls, setCls] = useState<string>('');
    const [subject, setSubject] = useState<string>('');

    // One board (NCERT for now) needs no choosing.
    useEffect(() => {
        if (!board && boards.length === 1) setBoard(boards[0]!);
    }, [board, boards]);

    const classes = useMemo(
        () => (board ? classesOf(knowledgeBases, board) : []),
        [knowledgeBases, board]
    );
    const subjects = useMemo(
        () => (board && cls ? subjectsOf(knowledgeBases, board, cls) : []),
        [knowledgeBases, board, cls]
    );
    const books = useMemo(
        () => (board && cls && subject ? booksOf(knowledgeBases, board, cls, subject) : []),
        [knowledgeBases, board, cls, subject]
    );

    const chooseSubject = (value: string) => {
        setSubject(value);
        const candidates = board && cls ? booksOf(knowledgeBases, board, cls, value) : [];
        if (candidates.length === 1) onPick(candidates[0]!);
    };

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                    <span className="text-caption text-neutral-600">{t('board')}</span>
                    <MyDropdown
                        currentValue={board}
                        dropdownList={boards.map((b) => ({ label: b, value: b }))}
                        placeholder={t('choose')}
                        handleChange={(v) => {
                            setBoard(v);
                            setCls('');
                            setSubject('');
                        }}
                        disable={boards.length <= 1}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-caption text-neutral-600">{t('class')}</span>
                    <MyDropdown
                        // MyDropdown prints currentValue verbatim when closed,
                        // so hand it the label ("Class 11"), not the value ("11").
                        currentValue={cls ? classLabel(cls, t) : ''}
                        dropdownList={classes.map((c) => ({ label: classLabel(c, t), value: c }))}
                        placeholder={t('choose')}
                        handleChange={(v) => {
                            setCls(v);
                            setSubject('');
                        }}
                        disable={!board}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-caption text-neutral-600">{t('subject')}</span>
                    <MyDropdown
                        currentValue={subject}
                        dropdownList={subjects.map((s) => ({ label: s, value: s }))}
                        placeholder={t('choose')}
                        handleChange={chooseSubject}
                        disable={!cls}
                    />
                </div>
            </div>

            {books.length > 1 && (
                <div className="flex flex-col gap-2">
                    <span className="text-caption text-neutral-600">{t('whichBook')}</span>
                    {books.map((kb) => (
                        <button
                            key={kb.id}
                            type="button"
                            onClick={() => onPick(kb)}
                            className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3 text-left transition-colors hover:border-primary-400 hover:bg-primary-50"
                        >
                            <span className="flex min-w-0 items-center gap-2">
                                <BookOpenText className="size-4 shrink-0 text-primary-500" />
                                <span className="truncate text-body font-medium text-neutral-700">
                                    {kb.curriculum?.book ?? kb.name}
                                </span>
                            </span>
                            <span className="shrink-0 text-caption text-neutral-500">
                                {t('chapters', {
                                    count: kb.stats?.sources ?? kb.source_count ?? 0,
                                })}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
