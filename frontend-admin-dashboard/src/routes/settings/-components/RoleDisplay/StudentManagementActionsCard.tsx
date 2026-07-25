import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { Plus, TrashSimple } from '@phosphor-icons/react';
import type {
    StudentManagementActionSettings,
    StudentHeaderCustomButton,
} from '@/types/display-settings';

interface StudentManagementActionsCardProps {
    settings: StudentManagementActionSettings | undefined;
    onChange: (next: StudentManagementActionSettings) => void;
}

// Stable id for a new custom button. crypto.randomUUID where available, with a
// timestamp fallback for older runtimes.
const genButtonId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `btn-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

export const StudentManagementActionsCard = ({
    settings,
    onChange,
}: StudentManagementActionsCardProps) => {
    const showEnrollButton = settings?.showEnrollButton !== false;
    const showInviteButton = settings?.showInviteButton !== false;
    const customButtons = settings?.customButtons ?? [];

    // Always emit the full object so nothing this card owns is dropped on save.
    const patch = (partial: Partial<StudentManagementActionSettings>) =>
        onChange({
            showEnrollButton,
            showInviteButton,
            customButtons,
            ...partial,
        });

    const updateButton = (id: string, changes: Partial<StudentHeaderCustomButton>) =>
        patch({
            customButtons: customButtons.map((b) => (b.id === id ? { ...b, ...changes } : b)),
        });

    const addButton = () =>
        patch({
            customButtons: [
                ...customButtons,
                { id: genButtonId(), label: '', url: '', openInNewTab: true },
            ],
        });

    const removeButton = (id: string) =>
        patch({ customButtons: customButtons.filter((b) => b.id !== id) });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Learner Management Buttons</CardTitle>
                <CardDescription>
                    Show or hide the built-in Enroll / Invite buttons and add custom link buttons
                    (e.g. an invite link or sub-org learner registration link) to the Learner
                    Management header.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-4 border-b border-border py-3.5">
                    <div className="text-sm font-medium text-neutral-800">Show Enroll button</div>
                    <Switch
                        checked={showEnrollButton}
                        onCheckedChange={(checked) => patch({ showEnrollButton: checked })}
                    />
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-border py-3.5">
                    <div className="text-sm font-medium text-neutral-800">Show Invite button</div>
                    <Switch
                        checked={showInviteButton}
                        onCheckedChange={(checked) => patch({ showInviteButton: checked })}
                    />
                </div>

                <div className="space-y-3 pt-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-neutral-800">Custom buttons</div>
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            onClick={addButton}
                            className="flex items-center gap-1"
                        >
                            <Plus className="size-4" />
                            Add button
                        </MyButton>
                    </div>

                    {customButtons.length === 0 ? (
                        <div className="rounded-md border border-dashed border-neutral-200 px-3 py-4 text-center text-xs text-neutral-500">
                            No custom buttons. Add one to surface an invite link or sub-org learner
                            registration link in the header.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {customButtons.map((btn) => (
                                <div
                                    key={btn.id}
                                    className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 sm:flex-row sm:items-end"
                                >
                                    <div className="flex-1">
                                        <MyInput
                                            label="Button label"
                                            inputType="text"
                                            inputPlaceholder="e.g. Register learners"
                                            input={btn.label}
                                            onChangeFunction={(e) =>
                                                updateButton(btn.id, { label: e.target.value })
                                            }
                                            className="sm:w-full"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <MyInput
                                            label="Link (URL)"
                                            inputType="text"
                                            inputPlaceholder="https://..."
                                            input={btn.url}
                                            onChangeFunction={(e) =>
                                                updateButton(btn.id, { url: e.target.value })
                                            }
                                            className="sm:w-full"
                                        />
                                    </div>
                                    <MyButton
                                        type="button"
                                        layoutVariant="icon"
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() => removeButton(btn.id)}
                                        className="shrink-0 text-danger-600 hover:border-danger-400"
                                    >
                                        <TrashSimple className="size-4" />
                                    </MyButton>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
