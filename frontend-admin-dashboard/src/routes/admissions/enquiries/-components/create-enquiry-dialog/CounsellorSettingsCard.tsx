import React from 'react';
import { Control, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { EnquiryForm } from '../../-schema/EnquirySchema';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { MyButton } from '@/components/design-system/button';

interface CounsellorSettingsCardProps {
    watch: UseFormWatch<EnquiryForm>;
    setValue: UseFormSetValue<EnquiryForm>;
}

export const CounsellorSettingsCard: React.FC<CounsellorSettingsCardProps> = ({
    watch,
    setValue,
}) => {
    const [counsellorInput, setCounsellorInput] = React.useState('');

    const allowParentSelection = watch('counsellor_settings.data.allowParentSelection');
    const autoAssignEnabled = watch('counsellor_settings.data.autoAssignEnabled');
    const assignmentStrategy = watch('counsellor_settings.data.assignmentStrategy');
    const counsellorIds = watch('counsellor_settings.data.counsellorIds') || [];

    const handleAllowParentSelectionChange = (checked: boolean) => {
        setValue('counsellor_settings.data.allowParentSelection', checked, {
            shouldValidate: true,
            shouldDirty: true,
        });

        // If parent selection is enabled, auto-assign must be disabled
        if (checked) {
            setValue('counsellor_settings.data.autoAssignEnabled', false, {
                shouldValidate: true,
                shouldDirty: true,
            });
        }
    };

    const handleAutoAssignChange = (checked: boolean) => {
        // If auto-assign is enabled, parent selection must be disabled
        if (checked) {
            setValue('counsellor_settings.data.allowParentSelection', false, {
                shouldValidate: true,
                shouldDirty: true,
            });
        }
        setValue('counsellor_settings.data.autoAssignEnabled', checked, {
            shouldValidate: true,
            shouldDirty: true,
        });
    };

    const handleAddCounsellor = () => {
        if (counsellorInput.trim()) {
            const updatedIds = [...counsellorIds, counsellorInput.trim()];
            setValue('counsellor_settings.data.counsellorIds', updatedIds, {
                shouldValidate: true,
                shouldDirty: true,
            });
            setCounsellorInput('');
        }
    };

    const handleRemoveCounsellor = (index: number) => {
        const updatedIds = counsellorIds.filter((_: string, i: number) => i !== index);
        setValue('counsellor_settings.data.counsellorIds', updatedIds, {
            shouldValidate: true,
            shouldDirty: true,
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCounsellor();
        }
    };

    return (
        <div className="space-y-6 rounded-lg border border-neutral-200 p-6">
            <div>
                <h3 className="text-lg font-semibold text-neutral-900">Counsellor Allocation</h3>
                <p className="mt-1 text-sm text-neutral-500">
                    Configure how counsellors are assigned to enquiries
                </p>
            </div>

            {/* Auto-Assign Enabled */}
            <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4">
                <div className="space-y-0.5">
                    <Label className="text-sm font-medium text-neutral-700">Auto-Assign</Label>
                    <p className="text-xs text-neutral-500">
                        Automatically assign enquiries to counsellors
                    </p>
                </div>
                <Switch
                    checked={autoAssignEnabled}
                    onCheckedChange={handleAutoAssignChange}
                    disabled={allowParentSelection}
                />
            </div>

            {/* Allow Parent Selection */}
            <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4">
                <div className="space-y-0.5">
                    <Label className="text-sm font-medium text-neutral-700">Allow Parent</Label>
                    <p className="text-xs text-neutral-500">
                        Let parents choose their preferred counsellor
                    </p>
                </div>
                <Switch
                    checked={allowParentSelection}
                    onCheckedChange={handleAllowParentSelectionChange}
                    disabled={autoAssignEnabled}
                />
            </div>

            {/* Assignment Strategy (only show when auto-assign is enabled) */}
            {autoAssignEnabled && (
                <div className="space-y-3">
                    <Label className="text-sm font-medium text-neutral-700">
                        Assignment Strategy
                    </Label>
                    <RadioGroup
                        value={assignmentStrategy}
                        onValueChange={(value: 'round_robin' | 'in_order') => {
                            setValue('counsellor_settings.data.assignmentStrategy', value, {
                                shouldValidate: true,
                                shouldDirty: true,
                            });
                        }}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-3 rounded-lg border border-neutral-200 p-3 hover:border-primary-300 hover:bg-primary-50/30">
                            <RadioGroupItem value="round_robin" id="round_robin" />
                            <Label htmlFor="round_robin" className="flex-1 cursor-pointer text-sm">
                                <div className="font-medium">Round Robin</div>
                                <div className="text-xs text-neutral-500">
                                    Distribute enquiries equally among counsellors
                                </div>
                            </Label>
                        </div>
                        <div className="flex items-center space-x-3 rounded-lg border border-neutral-200 p-3 hover:border-primary-300 hover:bg-primary-50/30">
                            <RadioGroupItem value="in_order" id="in_order" />
                            <Label htmlFor="in_order" className="flex-1 cursor-pointer text-sm">
                                <div className="font-medium">In Order</div>
                                <div className="text-xs text-neutral-500">
                                    Assign to counsellors in sequential order
                                </div>
                            </Label>
                        </div>
                    </RadioGroup>
                </div>
            )}

            {/* Counsellor IDs */}
            <div className="space-y-3">
                <Label className="text-sm font-medium text-neutral-700">
                    Counsellors <span className="text-neutral-400">(Optional)</span>
                </Label>
                <p className="text-xs text-neutral-500">Add counsellor IDs for assignment pool</p>

                {/* Existing counsellor chips */}
                {counsellorIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {counsellorIds.map((id: string, index: number) => (
                            <div
                                key={index}
                                className="flex items-center gap-1 rounded-md bg-primary-100 px-3 py-1.5 text-sm text-primary-700"
                            >
                                <span>{id}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveCounsellor(index)}
                                    className="ml-1 hover:text-primary-900"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add counsellor input */}
                <div className="flex gap-2">
                    <Input
                        type="text"
                        placeholder="Enter counsellor ID"
                        value={counsellorInput}
                        onChange={(e) => setCounsellorInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1"
                    />
                    <MyButton
                        type="button"
                        onClick={handleAddCounsellor}
                        buttonType="secondary"
                        scale="medium"
                        disabled={!counsellorInput.trim()}
                    >
                        Add
                    </MyButton>
                </div>
            </div>
        </div>
    );
};
