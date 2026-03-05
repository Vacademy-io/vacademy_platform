import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { Sortable, SortableDragHandle, SortableItem } from '@/components/ui/sortable';
import { MyButton } from '@/components/design-system/button';
import { DotsSixVertical, TrashSimple } from '@phosphor-icons/react';
import { Switch } from '@/components/ui/switch';
import { getCustomFieldSettingsFromCache } from '@/services/custom-field-settings';
import { useEffect } from 'react';

interface CustomField {
    id: string | number;
    field_id: number;
    name: string;
    type: string;
    oldKey: boolean;
    isRequired: boolean;
    key: string;
    order: number;
    status?: string;
    options?: Array<{
        id: string;
        value: string;
        disabled: boolean;
    }>;
}

interface EnquiryCustomFieldsCardProps {
    form: UseFormReturn<any>;
    updateFieldOrders: () => void;
    handleDeleteOpenField: (id: number) => void;
    toggleIsRequired: (id: number) => void;
}

/**
 * EnquiryCustomFieldsCard Component
 *
 * Displays fields with "Enquiry" location enabled from Custom Field Settings.
 * Admins can enable/disable and reorder which fields to include in their enquiry campaign.
 */
const EnquiryCustomFieldsCard = ({
    form,
    updateFieldOrders,
    handleDeleteOpenField,
    toggleIsRequired,
}: EnquiryCustomFieldsCardProps) => {
    const { control, getValues, setValue } = form;
    const { fields: customFieldsArray, move: moveCustomField } = useFieldArray({
        control,
        name: 'custom_fields',
    });

    // Initialize with enquiry location fields on mount
    useEffect(() => {
        const currentFields = getValues('custom_fields');

        // Only initialize if form is empty (create mode)
        if (!currentFields || currentFields.length === 0) {
            const settings = getCustomFieldSettingsFromCache();
            if (!settings) return;

            // Get all fields with enquiry location enabled
            const allFields = [
                ...(settings.customFields || []),
                ...(settings.instituteFields || []),
                ...(settings.fixedFields || []),
            ];

            const enquiryFields = allFields
                .filter((field) => field.visibility?.enquiry === true)
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            // Convert to form format
            const formFields = enquiryFields.map((field, index) => ({
                id: field.id,
                field_id: field.id,
                name: field.name,
                type: field.type === 'dropdown' ? 'dropdown' : 'textfield',
                oldKey: !field.canBeDeleted, // System/fixed fields
                isRequired: field.required,
                key: field.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                order: index,
                options:
                    field.type === 'dropdown' && field.options
                        ? field.options.map((opt, idx) => ({
                              id: String(idx),
                              value: opt,
                              disabled: true,
                          }))
                        : undefined,
            }));

            setValue('custom_fields', formFields, {
                shouldDirty: false,
                shouldTouch: false,
            });
        }
    }, [getValues, setValue]);

    return (
        <Card className="mb-4">
            <CardHeader>
                <CardTitle className="flex flex-col text-lg font-semibold">
                    <span className="text-2xl font-bold">Enquiry Form Fields</span>
                    <span className="text-sm text-gray-600">
                        Configure fields from Custom Field Settings
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex w-full flex-col gap-4">
                    {customFieldsArray.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center">
                            <p className="text-sm text-neutral-600">
                                No custom fields with "Enquiry" location enabled.
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">
                                Go to Settings → Custom Fields to enable fields for Enquiry
                                location.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <Sortable
                                value={customFieldsArray}
                                onMove={({ activeIndex, overIndex }) => {
                                    moveCustomField(activeIndex, overIndex);
                                    updateFieldOrders();
                                }}
                            >
                                <div className="flex flex-col gap-4">
                                    {customFieldsArray.map((field, index) => {
                                        // Type cast for proper TypeScript support
                                        const typedField = field as unknown as CustomField;

                                        // Skip deleted fields
                                        if (typedField?.status === 'DELETED') return null;

                                        return (
                                            <SortableItem
                                                key={typedField.id}
                                                value={typedField.id}
                                                asChild
                                            >
                                                <div
                                                    key={index}
                                                    className="flex items-center gap-4"
                                                >
                                                    <div className="flex w-3/4 items-center justify-between rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2">
                                                        <h1 className="text-sm">
                                                            {typedField.name}
                                                            {typedField.oldKey && (
                                                                <span className="text-subtitle text-danger-600">
                                                                    {' '}
                                                                    *
                                                                </span>
                                                            )}
                                                            {!typedField.oldKey &&
                                                                typedField.isRequired && (
                                                                    <span className="text-subtitle text-danger-600">
                                                                        {' '}
                                                                        *
                                                                    </span>
                                                                )}
                                                        </h1>
                                                        <div className="flex items-center gap-6">
                                                            {!typedField.oldKey && (
                                                                <MyButton
                                                                    type="button"
                                                                    scale="small"
                                                                    buttonType="secondary"
                                                                    className="min-w-6 !rounded-sm !p-0"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleDeleteOpenField(
                                                                            index
                                                                        );
                                                                    }}
                                                                >
                                                                    <TrashSimple className="!size-4 text-danger-500" />
                                                                </MyButton>
                                                            )}
                                                            <SortableDragHandle
                                                                variant="ghost"
                                                                size="icon"
                                                                className="cursor-grab"
                                                            >
                                                                <DotsSixVertical size={20} />
                                                            </SortableDragHandle>
                                                        </div>
                                                    </div>
                                                    {!typedField.oldKey && (
                                                        <>
                                                            <h1 className="text-sm">Required</h1>
                                                            <Switch
                                                                checked={typedField.isRequired}
                                                                onCheckedChange={() => {
                                                                    toggleIsRequired(index);
                                                                }}
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            </SortableItem>
                                        );
                                    })}
                                </div>
                            </Sortable>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default EnquiryCustomFieldsCard;
