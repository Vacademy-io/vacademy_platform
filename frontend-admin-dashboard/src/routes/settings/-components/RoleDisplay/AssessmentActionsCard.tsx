import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import type { AssessmentActionSettings } from '@/types/display-settings';

interface AssessmentActionsCardProps {
    settings: AssessmentActionSettings | undefined;
    onChange: (next: AssessmentActionSettings) => void;
}

const ROWS: {
    key: keyof AssessmentActionSettings;
    label: string;
    hint: string;
}[] = [
    {
        key: 'showCreateAssessment',
        label: 'Show "Create Assessment" button',
        hint: 'Assessments list header, the assessment type picker, the sidebar "Create …" shortcuts and the "Create new assessment" option inside a slide.',
    },
    {
        key: 'showEditAssessment',
        label: 'Show "Edit Assessment" button',
        hint: 'The pencil button on Assessment Details that reopens the create wizard for an existing assessment.',
    },
    {
        key: 'showDeleteAssessment',
        label: 'Show "Delete Assessment" option',
        hint: 'The Delete entry in each assessment card’s "…" menu, on the Assessments, Evaluation Centre and Homework lists.',
    },
];

export const AssessmentActionsCard = ({ settings, onChange }: AssessmentActionsCardProps) => {
    // Always emit the full object so no flag this card owns is dropped on save.
    const patch = (partial: Partial<AssessmentActionSettings>) =>
        onChange({
            showCreateAssessment: settings?.showCreateAssessment !== false,
            showEditAssessment: settings?.showEditAssessment !== false,
            showDeleteAssessment: settings?.showDeleteAssessment !== false,
            ...partial,
        });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Assessment Actions</CardTitle>
                <CardDescription>
                    Control whether this role can create, edit and delete assessments. All three are
                    on by default; turning one off hides that action everywhere it appears.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                {ROWS.map(({ key, label, hint }) => (
                    <div
                        key={key}
                        className="flex items-center justify-between gap-4 border-b border-border py-3.5 last:border-b-0"
                    >
                        <div>
                            <div className="text-sm font-medium text-neutral-800">{label}</div>
                            <div className="mt-0.5 text-caption text-neutral-500">{hint}</div>
                        </div>
                        <Switch
                            checked={settings?.[key] !== false}
                            onCheckedChange={(checked) => patch({ [key]: checked })}
                        />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};

export default AssessmentActionsCard;
