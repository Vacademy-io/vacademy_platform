import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, WarningCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { cn } from '@/lib/utils';
import { MenteePicker } from './MenteePicker';
import { reportApiError } from '@/lib/report-api-error';
import { assignmentNeedsAttention, assignmentResultMessage } from '../-utils/assignment-result';
import { assignmentBatchContext, openSeats, seatsLeft } from '../-utils/mentee-picker';
import { useBulkRoundRobin } from '../-hooks/use-mentorship';
import type { MentorDTO, StudentRow } from '../-types/mentorship-types';

interface BulkAssignDialogProps {
    mentors: MentorDTO[];
    instituteId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const mentorName = (m: MentorDTO) => m.display_name || m.name || 'Mentor';

/** Bulk-assign selected students across selected mentors, distributed evenly (round-robin). */
export function BulkAssignDialog({
    mentors,
    instituteId,
    open,
    onOpenChange,
}: BulkAssignDialogProps) {
    const [selectedStudents, setSelectedStudents] = useState<StudentRow[]>([]);
    const [selectedMentorIds, setSelectedMentorIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const bulk = useBulkRoundRobin();

    const toggleMentor = (id: string) =>
        setSelectedMentorIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );

    // A mentor with no room takes nothing, so offering them is a trap: the run
    // "succeeds" and reports everyone skipped.
    const selectableMentors = useMemo(() => mentors.filter((m) => !m.at_capacity), [mentors]);
    const fullMentors = useMemo(() => mentors.filter((m) => m.at_capacity), [mentors]);

    const chosenMentors = useMemo(
        () => mentors.filter((m) => selectedMentorIds.includes(m.id)),
        [mentors, selectedMentorIds]
    );
    const seats = openSeats(chosenMentors);
    const shortBy = seats == null ? 0 : Math.max(0, selectedStudents.length - seats);

    const perMentor = useMemo(
        () =>
            selectedMentorIds.length
                ? Math.ceil(selectedStudents.length / selectedMentorIds.length)
                : 0,
        [selectedStudents.length, selectedMentorIds.length]
    );

    const reset = () => {
        setSelectedStudents([]);
        setSelectedMentorIds([]);
    };

    const submit = async () => {
        if (!selectedStudents.length || !selectedMentorIds.length) {
            toast.error('Pick at least one mentor and one student');
            return;
        }
        setSubmitting(true);
        try {
            const res = await bulk.mutateAsync({
                institute_id: instituteId,
                student_user_ids: selectedStudents.map((s) => s.user_id),
                mentor_ids: selectedMentorIds,
                package_session_id: assignmentBatchContext(selectedStudents),
            });
            const message = assignmentResultMessage(res, 'bulk');
            if (assignmentNeedsAttention(res)) toast.warning(message);
            else toast.success(message);
            reset();
            onOpenChange(false);
        } catch (error) {
            reportApiError(error, {
                feature: 'mentorship',
                tags: { 'mentorship.action': 'bulk-round-robin' },
                extra: {
                    mentorCount: selectedMentorIds.length,
                    studentCount: selectedStudents.length,
                },
                fallbackMessage: 'Failed to distribute assignments',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <MyDialog
            heading="Bulk assign students to mentors"
            open={open}
            onOpenChange={(o) => {
                if (!o) reset();
                onOpenChange(o);
            }}
            dialogWidth="max-w-3xl"
            footer={
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <span className="text-caption text-neutral-500">
                        {selectedStudents.length} students · {selectedMentorIds.length} mentors
                        {perMentor ? ` · ~${perMentor} each` : ''}
                    </span>
                    <div className="flex gap-2">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            type="button"
                            buttonType="primary"
                            scale="medium"
                            onClick={submit}
                            disable={submitting}
                        >
                            {submitting ? 'Distributing…' : 'Distribute'}
                        </MyButton>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="text-caption text-neutral-500">
                    Pick the mentors to share the load, then pick the students. They are split
                    evenly across those mentors (round-robin), skipping anyone already assigned to
                    that mentor.
                </p>

                <div className="flex flex-col gap-2">
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                        <span className="text-caption font-medium text-neutral-600">
                            Step 1 · Mentors ({selectedMentorIds.length} of{' '}
                            {selectableMentors.length} selected)
                        </span>
                        {selectableMentors.length > 1 && (
                            <button
                                type="button"
                                className="text-caption font-medium text-primary-500 hover:text-primary-600"
                                onClick={() =>
                                    setSelectedMentorIds(
                                        selectedMentorIds.length === selectableMentors.length
                                            ? []
                                            : selectableMentors.map((m) => m.id)
                                    )
                                }
                            >
                                {selectedMentorIds.length === selectableMentors.length
                                    ? 'Clear'
                                    : 'Select all mentors'}
                            </button>
                        )}
                    </div>
                    {selectableMentors.length === 0 ? (
                        <span className="text-caption text-neutral-400">
                            {mentors.length === 0
                                ? 'No mentors yet — add a mentor first.'
                                : 'Every mentor is at their limit. Raise a capacity to assign more.'}
                        </span>
                    ) : (
                        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                            {selectableMentors.map((m) => {
                                const sel = selectedMentorIds.includes(m.id);
                                return (
                                    <button
                                        type="button"
                                        key={m.id}
                                        onClick={() => toggleMentor(m.id)}
                                        aria-pressed={sel}
                                        className={cn(
                                            'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-body',
                                            sel
                                                ? 'border-primary-400 bg-primary-50 text-primary-600'
                                                : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                                        )}
                                    >
                                        {sel && <Check size={14} weight="bold" />}
                                        <span>{mentorName(m)}</span>
                                        {seatsLeft(m) !== null && (
                                            <span className="text-caption text-neutral-400">
                                                {seatsLeft(m)} free
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {fullMentors.length > 0 && (
                        <span className="text-caption text-neutral-400">
                            {fullMentors.length}{' '}
                            {fullMentors.length === 1 ? 'mentor is' : 'mentors are'} at their limit
                            and can&apos;t take anyone: {fullMentors.map(mentorName).join(', ')}
                        </span>
                    )}
                </div>

                {shortBy > 0 && (
                    <p className="flex items-start gap-1.5 rounded-lg border border-warning-300 bg-warning-50 p-3 text-caption text-neutral-700">
                        <WarningCircle
                            size={16}
                            weight="fill"
                            className="mt-0.5 shrink-0 text-warning-600"
                        />
                        <span>
                            These mentors have {seats} {seats === 1 ? 'seat' : 'seats'} between
                            them, so {shortBy} of the {selectedStudents.length} selected students
                            will be left unassigned. Add another mentor or raise a capacity.
                        </span>
                    </p>
                )}

                <div className="flex flex-col gap-2">
                    <span className="text-caption font-medium text-neutral-600">
                        Step 2 · Students
                    </span>
                    <MenteePicker
                        instituteId={instituteId}
                        selected={selectedStudents}
                        onChange={setSelectedStudents}
                    />
                </div>
            </div>
        </MyDialog>
    );
}
