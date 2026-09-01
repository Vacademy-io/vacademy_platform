import { useState } from 'react';
import { toast } from 'sonner';
import { WarningCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MenteePicker } from './MenteePicker';
import { reportApiError } from '@/lib/report-api-error';
import { assignmentNeedsAttention, assignmentResultMessage } from '../-utils/assignment-result';
import { assignmentBatchContext, seatsLeft } from '../-utils/mentee-picker';
import { useAssignMentees } from '../-hooks/use-mentorship';
import type { MentorDTO, StudentRow } from '../-types/mentorship-types';

interface AssignMenteesDialogProps {
    mentor: MentorDTO | null;
    instituteId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** Manually assign a set of enrolled students to a single mentor. */
export function AssignMenteesDialog({
    mentor,
    instituteId,
    open,
    onOpenChange,
}: AssignMenteesDialogProps) {
    const [selected, setSelected] = useState<StudentRow[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const assign = useAssignMentees();

    if (!mentor) return null;

    const reset = () => setSelected([]);

    // Capacity is enforced server-side, so an over-sized selection isn't an error —
    // it silently leaves the overflow unassigned. Say so before they submit.
    const slots = seatsLeft(mentor);
    const overCapacity = slots != null && selected.length > slots;

    const submit = async () => {
        if (selected.length === 0) {
            toast.error('Select at least one student');
            return;
        }
        setSubmitting(true);
        try {
            const res = await assign.mutateAsync({
                institute_id: instituteId,
                mentor_id: mentor.id,
                student_user_ids: selected.map((s) => s.user_id),
                package_session_id: assignmentBatchContext(selected),
            });
            // Capacity can leave students unplaced, so a plain success toast would
            // hide them — warn instead whenever the run didn't place everyone.
            const message = assignmentResultMessage(res, 'manual');
            if (assignmentNeedsAttention(res)) toast.warning(message);
            else toast.success(message);
            reset();
            onOpenChange(false);
        } catch (error) {
            reportApiError(error, {
                feature: 'mentorship',
                tags: { 'mentorship.action': 'assign-mentees' },
                extra: { mentorId: mentor.id, studentCount: selected.length },
                fallbackMessage: 'Failed to assign students',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <MyDialog
            heading={`Assign students to ${mentor.display_name || mentor.name || 'mentor'}`}
            open={open}
            onOpenChange={(o) => {
                if (!o) reset();
                onOpenChange(o);
            }}
            dialogWidth="max-w-2xl"
            footer={
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    <span className="text-caption text-neutral-500">
                        {selected.length} selected
                        {slots != null ? ` · ${slots} of ${mentor.max_mentees} seats free` : ''}
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
                            title={
                                selected.length === 0
                                    ? 'Select at least one student below'
                                    : undefined
                            }
                        >
                            {submitting
                                ? 'Assigning…'
                                : selected.length > 1
                                  ? `Assign ${selected.length} students`
                                  : 'Assign student'}
                        </MyButton>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-3">
                <p className="text-caption text-neutral-500">
                    Filter by batch to take a whole class at once, or search by name. Everything you
                    tick stays selected as you move between batches.
                </p>
                {overCapacity && (
                    <p className="flex items-start gap-1.5 rounded-lg border border-warning-300 bg-warning-50 p-3 text-caption text-neutral-700">
                        <WarningCircle
                            size={16}
                            weight="fill"
                            className="mt-0.5 shrink-0 text-warning-600"
                        />
                        <span>
                            {slots === 0 ? (
                                <>
                                    This mentor is already at their limit of {mentor.max_mentees}.
                                    Nothing here will be assigned — raise their capacity, or spread
                                    the group across mentors with Bulk assign.
                                </>
                            ) : (
                                <>
                                    This mentor has {slots} {slots === 1 ? 'seat' : 'seats'} left.
                                    The first {slots} will be assigned and the rest skipped — raise
                                    their capacity, or spread the group across mentors with Bulk
                                    assign.
                                </>
                            )}
                        </span>
                    </p>
                )}
                <MenteePicker
                    instituteId={instituteId}
                    selected={selected}
                    onChange={setSelected}
                />
            </div>
        </MyDialog>
    );
}
