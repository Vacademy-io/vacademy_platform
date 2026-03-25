import React from 'react';
import type { PlanningFormData, LogType } from '../-types/types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { MyDropdown } from '@/components/design-system/dropdown';
import { MyInput } from '@/components/design-system/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MyLabel } from '@/components/design-system/my-label';
import { Checkbox } from '@/components/ui/checkbox';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface PlanningFormSection1Props {
    data: PlanningFormData;
    onChange: (data: Partial<PlanningFormData>) => void;
    fixedLogType?: LogType; // When provided, hides the log type selector
}

export default function PlanningFormSection1({
    data,
    onChange,
    fixedLogType,
}: PlanningFormSection1Props) {
    const { instituteDetails } = useInstituteDetailsStore();

    const subjectOptions =
        instituteDetails?.subjects?.map((subject) => ({
            label: subject.subject_name,
            value: subject.id,
        })) || [];

    const currentSubject = subjectOptions.find((opt) => opt.value === data.subject_id);

    // Auto-select subject if only one option exists
    const hasMultipleSubjects = subjectOptions.length > 1;

    // Auto-select the single subject if not already selected
    React.useEffect(() => {
        if (subjectOptions.length === 1 && !data.subject_id && subjectOptions[0]) {
            onChange({ subject_id: subjectOptions[0].value });
        }
    }, [subjectOptions, data.subject_id, onChange]);

    return (
        <div className="grid grid-cols-2 gap-4">
            {/* Log Type - Full width - Only show if not fixed */}
            {!fixedLogType && (
                <div className="col-span-2 space-y-2">
                    <MyLabel>Type</MyLabel>
                    <RadioGroup
                        value={data.log_type}
                        onValueChange={(value) => onChange({ log_type: value as LogType })}
                    >
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="planning" id="planning" />
                                <Label htmlFor="planning" className="cursor-pointer font-normal">
                                    Planning
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="diary_log" id="diary_log" />
                                <Label htmlFor="diary_log" className="cursor-pointer font-normal">
                                    Diary
                                </Label>
                            </div>
                        </div>
                    </RadioGroup>
                </div>
            )}

            {/* Custom Title Input - Only show when useCustomTitle is true */}
            {data.useCustomTitle && (
                <div className="col-span-2 space-y-2">
                    <MyInput
                        label="Title"
                        required
                        inputType="text"
                        inputPlaceholder="Enter your custom title"
                        input={data.title}
                        onChangeFunction={(e) => onChange({ title: e.target.value })}
                        className="w-full"
                        size="medium"
                    />
                </div>
            )}

            {/* Subject - Only show if multiple options */}
            {hasMultipleSubjects && (
                <div className="col-span-2 space-y-2">
                    <MyLabel required>Subject</MyLabel>
                    <MyDropdown
                        currentValue={currentSubject?.label}
                        handleChange={(value) => onChange({ subject_id: value })}
                        dropdownList={subjectOptions}
                        placeholder="Select subject"
                        className="w-full"
                    />
                </div>
            )}
            {/* Description - Full width */}
            <div className="col-span-2 space-y-2">
                <MyLabel>Description</MyLabel>
                <Textarea
                    id="description"
                    value={data.description}
                    onChange={(e) => onChange({ description: e.target.value })}
                    placeholder="Enter description (optional)"
                    rows={3}
                />
            </div>
            <div className="col-span-2 flex items-center space-x-2">
                <Checkbox
                    id="share-with-learner"
                    checked={data.is_shared_with_student}
                    onCheckedChange={(checked) =>
                        onChange({ is_shared_with_student: checked === true })
                    }
                />
                <label
                    htmlFor="share-with-learner"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    Share with{' '}
                    {getTerminology(RoleTerms.Learner, SystemTerms.Learner).toLocaleLowerCase()}
                </label>
            </div>
        </div>
    );
}
