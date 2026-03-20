import { useState, useEffect } from 'react';
import type { PlanningFormData } from '../-types/types';
import { Save } from 'lucide-react';
import { useCreatePlanningLogs } from '../-services/createPlanningLogs';
import { wrapContentInHTML } from '../-utils/templateLoader';
import { MyInput } from '@/components/design-system/input';
import { MyLabel } from '@/components/design-system/my-label';
import { Textarea } from '@/components/ui/textarea';
import { MyDropdown } from '@/components/design-system/dropdown';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import PlanningHTMLEditor from './PlanningHTMLEditor';
import { useGenerateIntervalTypeId } from '../-services/generateIntervalTypeId';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Checkbox } from '@/components/ui/checkbox';
import TitleGeneratorSection from './TitleGeneratorSection';

interface CreateActivityDialogProps {
    packageSessionId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export default function CreateActivityDialog({
    packageSessionId,
    open,
    onOpenChange,
    onSuccess,
}: CreateActivityDialogProps) {
    const { instituteDetails } = useInstituteDetailsStore();
    const createMutation = useCreatePlanningLogs();

    const [formData, setFormData] = useState<PlanningFormData>({
        log_type: 'diary_log',
        title: '',
        description: '',
        packageSessionId: packageSessionId,
        subject_id: '',
        interval_type: 'daily', // Fixed to daily for activity logs
        selectedDate: new Date(),
        interval_type_id: '',
        content_html: '',
        uploadedFileIds: [],
        is_shared_with_student: false,
    });

    const subjectOptions =
        instituteDetails?.subjects?.map((subject) => ({
            label: subject.subject_name,
            value: subject.id,
        })) || [];

    const currentSubject = subjectOptions.find((opt) => opt.value === formData.subject_id);

    // Use API to generate interval_type_id (always daily for activity logs)
    const { data: intervalTypeId } = useGenerateIntervalTypeId(
        formData.selectedDate ? { intervalType: 'daily', date: formData.selectedDate } : null
    );

    // Auto-select subject if only one option
    useEffect(() => {
        if (subjectOptions.length === 1 && !formData.subject_id && subjectOptions[0]) {
            setFormData((prev) => ({ ...prev, subject_id: subjectOptions[0]?.value || '' }));
        }
    }, [subjectOptions, formData.subject_id]);

    // Update interval_type_id when API returns data
    useEffect(() => {
        if (intervalTypeId) {
            setFormData((prev) => ({ ...prev, interval_type_id: intervalTypeId }));
        }
    }, [intervalTypeId]);

    const handleSave = async () => {
        try {
            await createMutation.mutateAsync({
                logs: [
                    {
                        log_type: 'diary_log',
                        entity: 'packageSession',
                        entity_id: packageSessionId,
                        interval_type: 'daily',
                        interval_type_id: formData.interval_type_id,
                        title: formData.title,
                        description: formData.description || undefined,
                        content_html: wrapContentInHTML(formData.content_html),
                        subject_id: formData.subject_id,
                        comma_separated_file_ids:
                            formData.uploadedFileIds.length > 0
                                ? formData.uploadedFileIds.join(',')
                                : undefined,
                        is_shared_with_student: formData.is_shared_with_student,
                    },
                ],
            });

            // Reset form
            setFormData({
                log_type: 'diary_log',
                title: '',
                description: '',
                packageSessionId: packageSessionId,
                subject_id: '',
                interval_type: 'daily',
                selectedDate: new Date(),
                interval_type_id: '',
                content_html: '',
                uploadedFileIds: [],
                is_shared_with_student: false,
            });

            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to create activity log:', error);
        }
    };

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading="Create Activity Log"
            dialogWidth="max-w-4xl"
            footer={
                <>
                    <MyButton
                        buttonType="secondary"
                        onClick={() => onOpenChange(false)}
                        disabled={createMutation.isPending}
                    >
                        Cancel
                    </MyButton>
                    <MyButton onClick={handleSave} disabled={createMutation.isPending}>
                        <Save className="mr-2 size-4" />
                        {createMutation.isPending ? 'Creating...' : 'Create'}
                    </MyButton>
                </>
            }
        >
            <div className="space-y-4">
                {/* Title Generator Section - Date Selector Only (interval type is fixed to daily) */}
                <TitleGeneratorSection
                    data={formData}
                    onChange={(updates) => setFormData({ ...formData, ...updates })}
                    hideIntervalType={true}
                    hideCourseSelector={true}
                />

                {/* Title - Editable */}
                <div className="space-y-2">
                    <MyInput
                        label="Title"
                        required
                        inputType="text"
                        inputPlaceholder="Auto-generated based on date"
                        input={formData.title}
                        onChangeFunction={(e) =>
                            setFormData({ ...formData, title: e.target.value })
                        }
                        className="w-full"
                        size="medium"
                    />
                    <p className="text-sm text-muted-foreground">
                        Title is auto-generated but you can edit it if needed
                    </p>
                </div>

                {/* Subject - Only show if multiple options */}
                {subjectOptions.length > 1 && (
                    <div className="space-y-2">
                        <MyLabel required>Subject</MyLabel>
                        <MyDropdown
                            currentValue={currentSubject?.label}
                            handleChange={(value) =>
                                setFormData({ ...formData, subject_id: value })
                            }
                            dropdownList={subjectOptions}
                            placeholder="Select subject"
                            className="w-full"
                        />
                    </div>
                )}

                {/* Description */}
                <div className="space-y-2">
                    <MyLabel>Description</MyLabel>
                    <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Enter description (optional)"
                        rows={3}
                    />
                </div>

                {/* Share with learner */}
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="share-with-learner-activity"
                        checked={formData.is_shared_with_student}
                        onCheckedChange={(checked) =>
                            setFormData({ ...formData, is_shared_with_student: checked === true })
                        }
                    />
                    <MyLabel
                        htmlFor="share-with-learner-activity"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Share with learner
                    </MyLabel>
                </div>

                {/* Content */}
                <div className="space-y-2">
                    <MyLabel required>Content</MyLabel>
                    <PlanningHTMLEditor
                        value={formData.content_html}
                        onChange={(html) => setFormData({ ...formData, content_html: html })}
                    />
                </div>
            </div>
        </MyDialog>
    );
}
