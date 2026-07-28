import { useState } from 'react';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { MyDialog } from '@/components/design-system/dialog';
import { UserSearchCombobox, type PickedUser } from '@/routes/meetings/-components/user-search-combobox';
import { useCreateMentor } from '../-hooks/use-mentorship';

interface AddMentorDialogProps {
    instituteId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** Promote an existing user to a mentor: pick the user, set a display name/title/bio. */
export function AddMentorDialog({ instituteId, open, onOpenChange }: AddMentorDialogProps) {
    const [picked, setPicked] = useState<PickedUser[]>([]);
    const [displayName, setDisplayName] = useState('');
    const [title, setTitle] = useState('');
    const [bio, setBio] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const createMentor = useCreateMentor();

    const user = picked[0];

    const reset = () => {
        setPicked([]);
        setDisplayName('');
        setTitle('');
        setBio('');
    };

    const submit = async () => {
        if (!user) {
            toast.error('Select a user to promote');
            return;
        }
        setSubmitting(true);
        try {
            await createMentor.mutateAsync({
                institute_id: instituteId,
                user_id: user.id,
                display_name: displayName || user.fullName,
                title,
                bio,
            });
            toast.success('Mentor added');
            reset();
            onOpenChange(false);
        } catch {
            toast.error('Failed to add mentor');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <MyDialog
            heading="Add mentor"
            open={open}
            onOpenChange={(o) => {
                if (!o) reset();
                onOpenChange(o);
            }}
            dialogWidth="max-w-lg"
            footer={
                <div className="flex justify-end gap-2">
                    <MyButton type="button" buttonType="secondary" scale="medium" onClick={() => onOpenChange(false)}>
                        Cancel
                    </MyButton>
                    <MyButton type="button" buttonType="primary" scale="medium" onClick={submit} disable={submitting}>
                        Add mentor
                    </MyButton>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <span className="text-caption text-neutral-500">User to promote</span>
                    <UserSearchCombobox
                        instituteId={instituteId}
                        value={picked}
                        onChange={setPicked}
                        mode="single"
                        placeholder="Search users…"
                    />
                </div>
                <MyInput
                    input={displayName}
                    onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                    inputType="text"
                    inputPlaceholder={user?.fullName || 'Display name'}
                    label="Display name"
                />
                <MyInput
                    input={title}
                    onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                    inputType="text"
                    inputPlaceholder="e.g. Senior Career Mentor"
                    label="Title"
                />
                <MyInput
                    input={bio}
                    onChangeFunction={(e: React.ChangeEvent<HTMLInputElement>) => setBio(e.target.value)}
                    inputType="text"
                    inputPlaceholder="Short bio (optional)"
                    label="Bio"
                />
            </div>
        </MyDialog>
    );
}
