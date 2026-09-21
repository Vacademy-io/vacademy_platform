import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
    LibraryTaxonomy,
    TaxonomyBoard,
    TaxonomyClass,
    TaxonomyExam,
    TaxonomySubject,
} from '../../-types/library';

export type Track = 'board' | 'exam';

/** What the teacher has picked. Keys are taxonomy keys, not display names. */
export interface TaxonomySelection {
    track: Track;
    board?: string;
    exam?: string;
    cls?: string;
    subject?: string;
    medium?: string;
}

interface TaxonomyPickerProps {
    taxonomy: LibraryTaxonomy;
    value: TaxonomySelection;
    onChange: (next: TaxonomySelection) => void;
    className?: string;
}

export const findBoard = (taxonomy: LibraryTaxonomy, key?: string): TaxonomyBoard | undefined =>
    key ? taxonomy.boards.find((b) => b.key === key) : undefined;

export const findExam = (taxonomy: LibraryTaxonomy, key?: string): TaxonomyExam | undefined =>
    key ? taxonomy.exams.find((e) => e.key === key) : undefined;

export const findClass = (board?: TaxonomyBoard, cls?: string): TaxonomyClass | undefined =>
    board && cls ? board.classes.find((c) => c.class === cls) : undefined;

// Select values are strings; "all" stands for no filter.
const ALL = 'all';
const BOARD = 'board:';
const EXAM = 'exam:';

/**
 * One option: the name, and on the right how many books answer it. A zero
 * is still offered — ICSE Class 9 Physics is a real choice that is not
 * loaded yet — but reads muted so the loaded material stands out.
 */
const Option = ({ value, label, count }: { value: string; label: string; count?: number }) => (
    <SelectItem value={value} className={cn(count === 0 && 'text-neutral-400')}>
        <span className="flex w-full items-center justify-between gap-4">
            <span>{label}</span>
            {count !== undefined && count > 0 && (
                <span className="text-caption text-neutral-400">{count}</span>
            )}
        </span>
    </SelectItem>
);

const Field = ({
    label,
    children,
    className,
}: {
    label: string;
    children: React.ReactNode;
    className?: string;
}) => (
    <label className={cn('flex min-w-0 flex-col gap-1', className)}>
        <span className="text-caption text-neutral-500">{label}</span>
        {children}
    </label>
);

/**
 * Board or exam → Class → Subject, as three selects on one line.
 *
 * Everything the taxonomy knows is offered, loaded or not, with the count of
 * books next to each option; the long tail (state boards, exams) sits in
 * groups inside the first select so the row stays short. Medium appears
 * only once more than one medium has actually been loaded.
 */
export const TaxonomyPicker = ({ taxonomy, value, onChange, className }: TaxonomyPickerProps) => {
    const { t } = useTranslation('knowledgeBaseLibraryBrowser');

    const board = findBoard(taxonomy, value.board);
    const exam = findExam(taxonomy, value.exam);
    const cls = findClass(board, value.cls);

    const groups = useMemo(
        () => ({
            national: taxonomy.boards.filter((b) => b.kind === 'NATIONAL'),
            state: taxonomy.boards.filter((b) => b.kind === 'STATE'),
            exams: taxonomy.exams,
        }),
        [taxonomy]
    );

    const trackValue = exam ? EXAM + exam.key : board ? BOARD + board.key : '';
    const setTrack = (v: string) => {
        if (v.startsWith(EXAM)) {
            onChange({ track: 'exam', exam: v.slice(EXAM.length), medium: value.medium });
        } else {
            onChange({ track: 'board', board: v.slice(BOARD.length), medium: value.medium });
        }
    };
    const setClass = (v: string) =>
        onChange({ ...value, cls: v === ALL ? undefined : v, subject: undefined });
    const setSubject = (v: string) => onChange({ ...value, subject: v === ALL ? undefined : v });
    const setMedium = (v: string) => onChange({ ...value, medium: v === ALL ? undefined : v });

    const subjects: TaxonomySubject[] | undefined = exam ? exam.subjects : cls?.subjects;
    const subjectsTotal = exam ? exam.libraries : cls?.libraries;

    return (
        <div className={cn('flex flex-wrap items-end gap-3', className)}>
            <Field label={t('picker.boardOrExam')} className="w-full sm:w-56">
                <Select value={trackValue} onValueChange={setTrack}>
                    <SelectTrigger>
                        {/* The trigger shows the name alone; counts live in the menu. */}
                        <SelectValue placeholder={t('picker.choose')}>
                            {exam?.name ?? board?.name}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                        <SelectGroup>
                            <SelectLabel>{t('picker.groupNational')}</SelectLabel>
                            {groups.national.map((b) => (
                                <Option
                                    key={b.key}
                                    value={BOARD + b.key}
                                    label={b.name}
                                    count={b.libraries}
                                />
                            ))}
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel>{t('picker.groupState')}</SelectLabel>
                            {groups.state.map((b) => (
                                <Option
                                    key={b.key}
                                    value={BOARD + b.key}
                                    label={b.name}
                                    count={b.libraries}
                                />
                            ))}
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel>{t('picker.groupExams')}</SelectLabel>
                            {groups.exams.map((e) => (
                                <Option
                                    key={e.key}
                                    value={EXAM + e.key}
                                    label={e.name}
                                    count={e.libraries}
                                />
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </Field>

            {board && (
                <Field label={t('picker.class')} className="w-full sm:w-40">
                    <Select value={value.cls ?? ALL} onValueChange={setClass}>
                        <SelectTrigger>
                            <SelectValue>
                                {value.cls
                                    ? t('classLabel', { number: value.cls })
                                    : t('picker.allClasses')}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                            <Option
                                value={ALL}
                                label={t('picker.allClasses')}
                                count={board.libraries}
                            />
                            {board.classes.map((c) => (
                                <Option
                                    key={c.class}
                                    value={c.class}
                                    label={t('classLabel', { number: c.class })}
                                    count={c.libraries}
                                />
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            )}

            {subjects && (
                <Field label={t('picker.subject')} className="w-full sm:w-56">
                    <Select value={value.subject ?? ALL} onValueChange={setSubject}>
                        <SelectTrigger>
                            <SelectValue>{value.subject ?? t('picker.allSubjects')}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                            <Option
                                value={ALL}
                                label={t('picker.allSubjects')}
                                count={subjectsTotal}
                            />
                            {subjects.map((s) => (
                                <Option
                                    key={s.name}
                                    value={s.name}
                                    label={s.name}
                                    count={s.libraries}
                                />
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            )}

            {taxonomy.mediums_loaded.length > 1 && (
                <Field label={t('picker.medium')} className="w-full sm:w-36">
                    <Select value={value.medium ?? ALL} onValueChange={setMedium}>
                        <SelectTrigger>
                            <SelectValue>{value.medium ?? t('picker.all')}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <Option value={ALL} label={t('picker.all')} />
                            {taxonomy.mediums.map((m) => (
                                <Option key={m} value={m} label={m} />
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            )}
        </div>
    );
};
