import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { Plus, TrashSimple } from '@phosphor-icons/react';
import type {
    StudentManagementActionSettings,
    StudentHeaderCustomButton,
    StudentHeaderButtonKind,
} from '@/types/display-settings';

interface StudentManagementActionsCardProps {
    settings: StudentManagementActionSettings | undefined;
    onChange: (next: StudentManagementActionSettings) => void;
}

const BUTTON_KIND_OPTIONS: {
    value: StudentHeaderButtonKind;
    label: string;
    hint: string;
}[] = [
    { value: 'url', label: 'Custom URL', hint: 'Opens the link you enter below.' },
    {
        value: 'suborg_learner_invite',
        label: 'Sub-org learner invite link',
        hint: 'Auto-fills the sub-org learner invite for the course being viewed. Shows only for a sub-org admin on a course’s Learner tab — learners who enroll through it appear in the sub-org admin’s learner list.',
    },
    {
        value: 'course_invite',
        label: 'Course learner invite link',
        hint: 'Auto-fills the course’s default learner invite link for the course being viewed.',
    },
];

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
                { id: genButtonId(), label: '', kind: 'url', url: '', openInNewTab: true },
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
                            {customButtons.map((btn) => {
                                const kind: StudentHeaderButtonKind = btn.kind ?? 'url';
                                const kindMeta =
                                    BUTTON_KIND_OPTIONS.find((o) => o.value === kind) ??
                                    BUTTON_KIND_OPTIONS[0]!;
                                return (
                                    <div
                                        key={btn.id}
                                        className="flex flex-col gap-3 rounded-md border border-neutral-200 p-3"
                                    >
                                        <div className="flex items-end gap-2">
                                            <div className="flex flex-1 flex-col gap-1">
                                                <Label className="text-subtitle font-regular">
                                                    Button type
                                                </Label>
                                                <Select
                                                    value={kind}
                                                    onValueChange={(v) =>
                                                        updateButton(btn.id, {
                                                            kind: v as StudentHeaderButtonKind,
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {BUTTON_KIND_OPTIONS.map((o) => (
                                                            <SelectItem key={o.value} value={o.value}>
                                                                {o.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
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

                                        <MyInput
                                            label="Button label"
                                            inputType="text"
                                            inputPlaceholder="e.g. Invite learners"
                                            input={btn.label}
                                            onChangeFunction={(e) =>
                                                updateButton(btn.id, { label: e.target.value })
                                            }
                                            className="sm:w-full"
                                        />

                                        {kind === 'url' ? (
                                            <MyInput
                                                label="Link (URL)"
                                                inputType="text"
                                                inputPlaceholder="https://..."
                                                input={btn.url ?? ''}
                                                onChangeFunction={(e) =>
                                                    updateButton(btn.id, { url: e.target.value })
                                                }
                                                className="sm:w-full"
                                            />
                                        ) : (
                                            <p className="text-xs text-neutral-500">
                                                {kindMeta.hint}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
