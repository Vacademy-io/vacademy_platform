import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { cn } from '@/lib/utils';
import { MenteePicker } from './MenteePicker';
import { useBulkRoundRobin } from '../-hooks/use-mentorship';
import type { MentorDTO, StudentRow } from '../-types/mentorship-types';

interface BulkAssignDialogProps {
    mentors: MentorDTO[];
    instituteId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** Bulk-assign selected students across selected mentors, distributed evenly (round-robin). */
export function BulkAssignDialog({ mentors, instituteId, open, onOpenChange }: BulkAssignDialogProps) {
    const [selectedStudents, setSelectedStudents] = useState<StudentRow[]>([]);
    const [selectedMentorIds, setSelectedMentorIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const bulk = useBulkRoundRobin();

    const toggleMentor = (id: string) =>
        setSelectedMentorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const perMentor = useMemo(
        () => (selectedMentorIds.length ? Math.ceil(selectedStudents.length / selectedMentorIds.length) : 0),
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
            });
            toast.success(`Assigned ${res.assigned}${res.skipped ? `, ${res.skipped} skipped` : ''}`);
            reset();
            onOpenChange(false);
        } catch {
            toast.error('Failed to distribute assignments');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <MyDialog
            heading="Bulk assign (round-robin)"
            open={open}
            onOpenChange={(o) => {
                if (!o) reset();
                onOpenChange(o);
            }}
            dialogWidth="max-w-2xl"
            footer={
                <div className="flex items-center justify-between gap-2">
                    <span className="text-caption text-neutral-500">
                        {selectedStudents.length} students · {selectedMentorIds.length} mentors
                        {perMentor ? ` · ~${perMentor} each` : ''}
                    </span>
                    <div className="flex gap-2">
                        <MyButton type="button" buttonType="secondary" scale="medium" onClick={() => onOpenChange(false)}>
                            Cancel
                        </MyButton>
                        <MyButton type="button" buttonType="primary" scale="medium" onClick={submit} disable={submitting}>
                            Distribute
                        </MyButton>
                    </div>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <span className="text-caption text-neutral-500">
                        Mentors ({selectedMentorIds.length} selected)
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {mentors.map((m) => {
                            const sel = selectedMentorIds.includes(m.id);
                            return (
                                <button
                                    type="button"
                                    key={m.id}
                                    onClick={() => toggleMentor(m.id)}
                                    className={cn(
                                        'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-body',
                                        sel
                                            ? 'border-primary-400 bg-primary-50 text-primary-600'
                                            : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                                    )}
                                >
                                    {sel && <Check size={14} weight="bold" />}
                                    <span>{m.display_name || m.name || 'Mentor'}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <MenteePicker instituteId={instituteId} selected={selectedStudents} onChange={setSelectedStudents} />
            </div>
        </MyDialog>
    );
}
