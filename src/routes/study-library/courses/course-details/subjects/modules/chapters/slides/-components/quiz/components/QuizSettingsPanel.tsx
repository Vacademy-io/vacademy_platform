import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';

export interface QuizSettings {
    timeLimitEnabled: boolean;
    timeLimitMinutes: number;
    marksPerQuestion: number;
    negativeMarkingEnabled: boolean;
    negativeMarking: number;
}

interface QuizSettingsPanelProps {
    settings: QuizSettings;
    onChange: (settings: QuizSettings) => void;
    onSave: () => void;
    isSaving: boolean;
}

const QuizSettingsPanel = ({ settings, onChange, onSave, isSaving }: QuizSettingsPanelProps) => {
    const update = (patch: Partial<QuizSettings>) => onChange({ ...settings, ...patch });

    return (
        <div className="flex flex-wrap items-center gap-4 border-b border-neutral-200 bg-neutral-50 px-6 py-3 text-sm">
            {/* Time Limit */}
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="qs-time-limit"
                    className="accent-primary-500"
                    checked={settings.timeLimitEnabled}
                    onChange={(e) => update({ timeLimitEnabled: e.target.checked })}
                />
                <label htmlFor="qs-time-limit" className="font-medium text-neutral-700 select-none cursor-pointer">
                    ⏱ Time Limit
                </label>
                {settings.timeLimitEnabled && (
                    <div className="flex items-center gap-1">
                        <MyInput
                            inputType="number"
                            input={String(settings.timeLimitMinutes)}
                            onChangeFunction={(e) =>
                                update({ timeLimitMinutes: Math.max(1, parseInt(e.target.value) || 1) })
                            }
                            className="!w-16 text-center"
                            inputPlaceholder="30"
                        />
                        <span className="text-neutral-500">min</span>
                    </div>
                )}
            </div>

            <div className="h-4 w-px bg-neutral-300" />

            {/* Marks per Question */}
            <div className="flex items-center gap-2">
                <label className="font-medium text-neutral-700">★ Marks/Q</label>
                <MyInput
                    inputType="number"
                    input={String(settings.marksPerQuestion)}
                    onChangeFunction={(e) =>
                        update({ marksPerQuestion: Math.max(0.25, parseFloat(e.target.value) || 1) })
                    }
                    className="!w-16 text-center"
                    inputPlaceholder="1"
                />
            </div>

            <div className="h-4 w-px bg-neutral-300" />

            {/* Negative Marking */}
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="qs-neg-marking"
                    className="accent-primary-500"
                    checked={settings.negativeMarkingEnabled}
                    onChange={(e) => update({ negativeMarkingEnabled: e.target.checked })}
                />
                <label htmlFor="qs-neg-marking" className="font-medium text-neutral-700 select-none cursor-pointer">
                    − Negative
                </label>
                {settings.negativeMarkingEnabled && (
                    <MyInput
                        inputType="number"
                        input={String(settings.negativeMarking)}
                        onChangeFunction={(e) =>
                            update({ negativeMarking: Math.max(0, parseFloat(e.target.value) || 0) })
                        }
                        className="!w-16 text-center"
                        inputPlaceholder="0.25"
                    />
                )}
            </div>

            <div className="ml-auto">
                <MyButton
                    type="button"
                    buttonType="primary"
                    scale="small"
                    layoutVariant="default"
                    onClick={onSave}
                    disabled={isSaving}
                >
                    {isSaving ? 'Saving…' : 'Save Settings'}
                </MyButton>
            </div>
        </div>
    );
};

export default QuizSettingsPanel;
