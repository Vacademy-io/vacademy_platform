import { useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import type { PlanningFormData, IntervalType } from '../-types/types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { MyDropdown } from '@/components/design-system/dropdown';
import { MyLabel } from '@/components/design-system/my-label';
import IntervalSelector from './IntervalSelector';
import { Switch } from '@/components/ui/switch';

interface TitleGeneratorSectionProps {
    data: PlanningFormData;
    onChange: (data: Partial<PlanningFormData>) => void;
    hideIntervalType?: boolean; // For activity logs
    hideCourseSelector?: boolean; // For course details dialogs where course is pre-filled
}

export default function TitleGeneratorSection({
    data,
    onChange,
    hideIntervalType,
    hideCourseSelector,
}: TitleGeneratorSectionProps) {
    const { instituteDetails } = useInstituteDetailsStore();

    const packageSessionOptions =
        instituteDetails?.batches_for_sessions?.map((batch) => ({
            label: `${batch.package_dto.package_name} - ${batch.level.level_name} - ${batch.session.session_name}`,
            value: batch.id,
        })) || [];

    const intervalOptions = [
        { label: 'Daily', value: 'daily' },
        { label: 'Day of Week', value: 'weekly' },
        { label: 'Weekly', value: 'monthly' },
        { label: 'Monthly', value: 'yearly_month' },
        { label: 'Quarterly', value: 'yearly_quarter' },
    ];

    const currentPackageSession = packageSessionOptions.find(
        (opt) => opt.value === data.packageSessionId
    );

    // For planning logs (hideIntervalType = false), filter out 'daily' from dropdown
    const displayIntervalOptions = hideIntervalType
        ? intervalOptions
        : intervalOptions.filter((opt) => opt.value !== 'daily');

    const currentInterval = intervalOptions.find((opt) => opt.value === data.interval_type);

    // Generate title - use useMemo to avoid unnecessary recalculations
    const generatedTitle = useMemo(() => {
        if (!data.interval_type || !data.selectedDate) return '';

        let titlePrefix = '';

        switch (data.interval_type) {
            case 'daily':
                titlePrefix = format(data.selectedDate, 'dd MMM, yyyy');
                break;
            case 'weekly':
                titlePrefix = format(data.selectedDate, 'EEEE');
                break;
            case 'monthly': {
                const weekOfMonth = Math.ceil(data.selectedDate.getDate() / 7);
                titlePrefix = `Week ${weekOfMonth}`;
                break;
            }
            case 'yearly_month':
                titlePrefix = format(data.selectedDate, 'MMMM');
                break;
            case 'yearly_quarter': {
                const month = data.selectedDate.getMonth();
                const quarters = [
                    'Jan-Mar',
                    'Jan-Mar',
                    'Jan-Mar',
                    'Apr-Jun',
                    'Apr-Jun',
                    'Apr-Jun',
                    'Jul-Sep',
                    'Jul-Sep',
                    'Jul-Sep',
                    'Oct-Dec',
                    'Oct-Dec',
                    'Oct-Dec',
                ];
                titlePrefix = quarters[month] || 'Q1';
                break;
            }
            default:
                titlePrefix = '';
        }

        // Append course name if packageSessionId is set
        if (data.packageSessionId && currentPackageSession) {
            const courseName = currentPackageSession.label.split(' - ')[0];
            const sessionName = currentPackageSession.label.split(' - ')[1];
            const levelName = currentPackageSession.label.split(' - ')[2];
            return `${titlePrefix} - ${courseName}/${levelName}/${sessionName}`;
        }

        return titlePrefix;
    }, [data.interval_type, data.selectedDate, data.packageSessionId, currentPackageSession]);

    // Update title when it changes (only if not using custom title)
    useEffect(() => {
        if (!data.useCustomTitle && generatedTitle && generatedTitle !== data.title) {
            onChange({ title: generatedTitle });
        }
    }, [generatedTitle, data.useCustomTitle]);

    return (
        <div className="space-y-4">
            {/* Interval Type - Only show if not hidden (hidden for activity logs) */}
            {!hideIntervalType && (
                <div className="space-y-2">
                    <MyLabel required>Interval</MyLabel>
                    <MyDropdown
                        currentValue={currentInterval?.label}
                        handleChange={(value) => onChange({ interval_type: value as IntervalType })}
                        dropdownList={displayIntervalOptions}
                        placeholder="Select interval"
                        className="w-full"
                    />
                </div>
            )}

            {/* Dynamic Interval Selector */}
            {data.interval_type && (
                <div className="space-y-2">
                    <IntervalSelector
                        intervalType={data.interval_type}
                        selectedDate={data.selectedDate}
                        onChange={(date) => onChange({ selectedDate: date })}
                    />
                </div>
            )}

            {/* Batch Selection - Only show if not hidden (hidden in course details dialogs) */}
            {!hideCourseSelector && (
                <div className="space-y-2">
                    <MyLabel required>Batch</MyLabel>
                    <MyDropdown
                        currentValue={currentPackageSession?.label}
                        handleChange={(value) => onChange({ packageSessionId: value })}
                        dropdownList={packageSessionOptions}
                        placeholder="Select batch"
                        className="w-full"
                    />
                </div>
            )}

            {/* Title Mode Switch */}
            <div className="flex items-center justify-between  p-1">
                <label className="mr-2 text-base">Custom Title</label>
                <Switch
                    id="custom-title-switch"
                    checked={data.useCustomTitle || false}
                    onCheckedChange={(checked) => {
                        onChange({ useCustomTitle: checked });
                        // If switching to auto-generated, set the generated title
                        if (!checked && generatedTitle) {
                            onChange({ title: generatedTitle, useCustomTitle: checked });
                        }
                    }}
                />
            </div>

            {/* Auto-generated Title Display - Only show when NOT using custom */}
            {!data.useCustomTitle && generatedTitle && (
                <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Title:</p>
                    <p className="text-base font-semibold">{generatedTitle}</p>
                </div>
            )}
        </div>
    );
}
