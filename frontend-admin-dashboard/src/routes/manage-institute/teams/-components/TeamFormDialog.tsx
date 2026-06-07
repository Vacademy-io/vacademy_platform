import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { createTeam, updateTeam, type OrgTeamNode } from '../-services/org-team-services';
import { toast } from 'sonner';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    instituteId: string;
    /** When set, the dialog edits this team. When undefined, it creates a new team. */
    team?: OrgTeamNode | null;
    /** Parent for new teams. Null = top-level team. */
    defaultParentId?: string | null;
    /** Friendly name of the parent — shown so the user knows where the new team will sit. */
    defaultParentName?: string | null;
    onSaved?: () => void;
}

/**
 * Friendly create/edit dialog for a single team. Re-parenting is handled by
 * the separate Move dialog, so this form only worries about name +
 * description — two fields any non-technical admin can fill in.
 */
export function TeamFormDialog({
    open,
    onOpenChange,
    instituteId,
    team,
    defaultParentId,
    defaultParentName,
    onSaved,
}: Props) {
    const editing = !!team;
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setName(team?.name ?? '');
            setDescription(team?.description ?? '');
            setSaving(false);
        }
    }, [open, team]);

    async function handleSave() {
        if (!name.trim()) {
            toast.error('Give this team a name');
            return;
        }
        setSaving(true);
        try {
            if (editing && team) {
                await updateTeam(team.id, { name: name.trim(), description });
            } else {
                await createTeam({
                    institute_id: instituteId,
                    parent_id: defaultParentId ?? null,
                    name: name.trim(),
                    description,
                });
            }
            toast.success(editing ? 'Team updated' : `“${name.trim()}” created`);
            onSaved?.();
            onOpenChange(false);
        } catch (e) {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? (editing ? 'Update failed' : 'Create failed'));
        } finally {
            setSaving(false);
        }
    }

    const title = editing
        ? `Edit ${team?.name ?? 'team'}`
        : defaultParentName
          ? `New team inside ${defaultParentName}`
          : 'New team';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-h3">{title}</DialogTitle>
                    {!editing && (
                        <p className="text-subtitle text-neutral-500">
                            {defaultParentName
                                ? `This will be a sub-team under ${defaultParentName}.`
                                : 'This will be a top-level team. You can add sub-teams under it later.'}
                        </p>
                    )}
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-caption font-medium text-neutral-700">
                            Team name
                        </label>
                        <input
                            autoFocus
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-body"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder='e.g. "Sales", "Sales — North", "Finance"'
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-caption font-medium text-neutral-700">
                            What does this team do? <span className="text-neutral-400">(optional)</span>
                        </label>
                        <textarea
                            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-body"
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="A short note so teammates know what this team covers."
                        />
                    </div>
                </div>

                <DialogFooter>
                    <MyButton buttonType="secondary" onClick={() => onOpenChange(false)} disable={saving}>
                        Cancel
                    </MyButton>
                    <MyButton buttonType="primary" onClick={handleSave} disable={saving}>
                        {saving ? 'Saving…' : editing ? 'Save changes' : 'Create team'}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
