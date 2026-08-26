import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { ExamCalculatorMode, ExamExperienceSettings } from '@/types/assessment-settings';

interface ExamExperienceSettingsCardProps {
    settings: ExamExperienceSettings;
    onChange: (next: ExamExperienceSettings) => void;
}

interface ToggleRowProps {
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    children?: React.ReactNode;
}

const ToggleRow = ({ label, description, checked, onCheckedChange, children }: ToggleRowProps) => (
    <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-gray-500">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
        {checked && children ? <div className="mt-4 border-t pt-4">{children}</div> : null}
    </div>
);

/**
 * Live-test experience toggles. These drive the learner app's exam shell —
 * which tools a learner gets, whether the question palette is available, and
 * how much app chrome survives on a phone.
 */
const ExamExperienceSettingsCard = ({ settings, onChange }: ExamExperienceSettingsCardProps) => {
    const patch = (next: Partial<ExamExperienceSettings>) => onChange({ ...settings, ...next });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Live Test Experience</CardTitle>
                <CardDescription>
                    Controls what learners see while attempting an assessment, on both web and
                    mobile.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <ToggleRow
                    label="Calculator"
                    description="Show an on-screen calculator inside the test."
                    checked={settings.calculator.enabled}
                    onCheckedChange={(enabled) =>
                        patch({ calculator: { ...settings.calculator, enabled } })
                    }
                >
                    <div className="flex flex-col gap-2">
                        <Label className="text-sm font-medium">Calculator type</Label>
                        <Select
                            value={settings.calculator.mode}
                            onValueChange={(mode) =>
                                patch({
                                    calculator: {
                                        ...settings.calculator,
                                        mode: mode as ExamCalculatorMode,
                                    },
                                })
                            }
                        >
                            <SelectTrigger className="w-full max-w-xs">
                                <SelectValue placeholder="Select calculator type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="basic">Basic (four function)</SelectItem>
                                <SelectItem value="scientific">
                                    Scientific (JEE / NEET style)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                            Scientific adds trigonometry and its inverses, logarithms, powers and
                            roots, factorial, π and e, and a DEG/RAD toggle.
                        </p>
                    </div>
                </ToggleRow>

                <ToggleRow
                    label="Scratchpad"
                    description="A rough-work notepad. Its contents are never submitted with the paper."
                    checked={settings.scratchpad.enabled}
                    onCheckedChange={(enabled) => patch({ scratchpad: { enabled } })}
                />

                <ToggleRow
                    label="Question palette"
                    description="Lets learners jump between questions and see answered / marked status."
                    checked={settings.questionPalette.enabled}
                    onCheckedChange={(enabled) =>
                        patch({ questionPalette: { ...settings.questionPalette, enabled } })
                    }
                >
                    <div className="flex flex-col gap-2">
                        <Label className="text-sm font-medium">Default view</Label>
                        <Select
                            value={settings.questionPalette.defaultView}
                            onValueChange={(defaultView) =>
                                patch({
                                    questionPalette: {
                                        ...settings.questionPalette,
                                        defaultView: defaultView as 'grid' | 'list',
                                    },
                                })
                            }
                        >
                            <SelectTrigger className="w-full max-w-xs">
                                <SelectValue placeholder="Select default view" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="grid">Grid of question numbers</SelectItem>
                                <SelectItem value="list">List with question preview</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </ToggleRow>

                <ToggleRow
                    label="Show marking scheme on each question"
                    description="Displays the marks awarded and deducted beside every question."
                    checked={settings.showMarkingScheme}
                    onCheckedChange={(showMarkingScheme) => patch({ showMarkingScheme })}
                />

                <ToggleRow
                    label="Hide app navigation on mobile"
                    description="During a live test on a phone, hide the chatbot launcher and other app chrome so only the assessment is visible."
                    checked={settings.mobile.hideAppNavigation}
                    onCheckedChange={(hideAppNavigation) =>
                        patch({ mobile: { hideAppNavigation } })
                    }
                />
            </CardContent>
        </Card>
    );
};

export default ExamExperienceSettingsCard;
