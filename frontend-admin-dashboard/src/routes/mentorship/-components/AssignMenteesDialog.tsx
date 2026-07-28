import { useState } from 'react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { MenteePicker } from './MenteePicker';
import { useAssignMentees } from '../-hooks/use-mentorship';
import type { MentorDTO, StudentRow } from '../-types/mentorship-types';

interface AssignMenteesDialogProps {
    mentor: MentorDTO | null;
    instituteId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** Manually assign a set of enrolled students to a single mentor. */
export function AssignMenteesDialog({ mentor, instituteId, open, onOpenChange }: AssignMenteesDialogProps) {
    const [selected, setSelected] = useState<StudentRow[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const assign = useAssignMentees();

    if (!mentor) return null;

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
            });
            toast.success(
                `Assigned ${res.assigned}${res.skipped ? `, ${res.skipped} already assigned` : ''}`
            );
            setSelected([]);
            onOpenChange(false);
        } catch {
            toast.error('Failed to assign students');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <MyDialog
            heading={`Assign students to ${mentor.display_name || mentor.name || 'mentor'}`}
            open={open}
            onOpenChange={(o) => {
                if (!o) setSelected([]);
                onOpenChange(o);
            }}
            dialogWidth="max-w-lg"
            footer={
                <div className="flex justify-end gap-2">
                    <MyButton type="button" buttonType="secondary" scale="medium" onClick={() => onOpenChange(false)}>
                        Cancel
                    </MyButton>
                    <MyButton type="button" buttonType="primary" scale="medium" onClick={submit} disable={submitting}>
                        Assign
                    </MyButton>
                </div>
            }
        >
            <MenteePicker instituteId={instituteId} selected={selected} onChange={setSelected} />
        </MyDialog>
    );
}
