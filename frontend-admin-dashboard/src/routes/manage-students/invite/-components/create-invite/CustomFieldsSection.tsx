import { MyButton } from '@/components/design-system/button';
import { Switch } from '@/components/ui/switch';
import { DotsSixVertical, Plus, TrashSimple } from '@phosphor-icons/react';
import { AddCustomFieldDialog, DropdownOption } from './AddCustomFieldDialog';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { InviteForm } from '../../-schema/InviteFormSchema';
import { MandatoryKeys } from '../../-utils/inviteLinkKeyChecks';
import { Sortable, SortableDragHandle, SortableItem } from '@/components/ui/sortable';

interface CustomFieldsSectionProps {
    toggleIsRequired: (id: number) => void;
    handleAddOpenFieldValues: (
        type: string,
        name: string,
        oldKey: boolean,
        options?: DropdownOption[]
    ) => void;
    handleDeleteOpenField: (id: number) => void;
}

export const CustomFieldsSection = ({
    toggleIsRequired,
    handleAddOpenFieldValues,
    handleDeleteOpenField,
}: CustomFieldsSectionProps) => {
    const { watch, control } = useFormContext<InviteForm>();
    const customFields = watch('custom_fields');
    const { fields, move } = useFieldArray({
        control,
        name: 'custom_fields',
    });

    const handleAddCustomField = (
        type: string,
        name: string,
        oldKey: boolean,
        options?: DropdownOption[]
    ) => {
        handleAddOpenFieldValues(type, name, oldKey, options);
    };

    return (
        <div className="flex flex-col gap-4">
            <p className="text-title font-semibold">Invite input field</p>
            <Sortable
                value={fields}
                onMove={({ activeIndex, overIndex }) => {
                    move(activeIndex, overIndex);
                }}
                fast={false}
            >
                <div className="flex flex-col gap-4">
                    {fields.map((field) => (
                        <SortableItem key={field.id} value={field.id} asChild>
                            <div
                                className={`flex items-center gap-4 ${
                                    field.status === 'DELETED' ? 'hidden' : ''
                                }`}
                            >
                                <div className="flex w-3/4 items-center justify-between rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2">
                                    <h1 className="text-sm">
                                        {field.name}
                                        {field.oldKey && (
                                            <span className="text-subtitle text-danger-600">*</span>
                                        )}
                                        {!field.oldKey && field.isRequired && (
                                            <span className="text-subtitle text-danger-600">*</span>
                                        )}
                                    </h1>
                                    <div className="flex items-center gap-6">
                                        {!field.oldKey && !MandatoryKeys(field.name) && (
                                            <MyButton
                                                type="button"
                                                scale="small"
                                                buttonType="secondary"
                                                className="min-w-6 !rounded-sm !p-0"
                                                onClick={() => handleDeleteOpenField(field.id)}
                                            >
                                                <TrashSimple className="!size-4 text-danger-500" />
                                            </MyButton>
                                        )}
                                        <SortableDragHandle
                                            variant="ghost"
                                            size="icon"
                                            className="cursor-grab"
                                            type="button"
                                        >
                                            <DotsSixVertical size={20} />
                                        </SortableDragHandle>
                                    </div>
                                </div>
                                {!field.oldKey && !MandatoryKeys(field.name) && (
                                    <>
                                        <h1 className="text-sm">Required</h1>
                                        <Switch
                                            checked={field.isRequired}
                                            onCheckedChange={() => toggleIsRequired(field.id)}
                                        />
                                    </>
                                )}
                            </div>
                        </SortableItem>
                    ))}
                </div>
            </Sortable>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
                {!customFields
                    ?.filter((field) => field.status === 'ACTIVE')
                    ?.some((field) => field.name === 'Gender') && (
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        onClick={() =>
                            handleAddOpenFieldValues('dropdown', 'Gender', false, [
                                { id: 0, value: 'MALE', disabled: false },
                                { id: 1, value: 'FEMALE', disabled: false },
                                { id: 2, value: 'OTHER', disabled: false },
                            ])
                        }
                    >
                        <Plus size={32} /> Add Gender
                    </MyButton>
                )}
                {!customFields
                    ?.filter((field) => field.status === 'ACTIVE')
                    ?.some((field) => field.name === 'State') && (
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        onClick={() => handleAddOpenFieldValues('textfield', 'State', false)}
                    >
                        <Plus size={32} /> Add State
                    </MyButton>
                )}
                {!customFields
                    ?.filter((field) => field.status === 'ACTIVE')
                    ?.some((field) => field.name === 'City') && (
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        onClick={() => handleAddOpenFieldValues('textfield', 'City', false)}
                    >
                        <Plus size={32} /> Add City
                    </MyButton>
                )}
                {!customFields
                    ?.filter((field) => field.status === 'ACTIVE')
                    ?.some((field) => field.name === 'School/College') && (
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        onClick={() =>
                            handleAddOpenFieldValues('textfield', 'School/College', false)
                        }
                    >
                        <Plus size={32} /> Add School/College
                    </MyButton>
                )}
                {!customFields
                    ?.filter((field) => field.status === 'ACTIVE')
                    ?.some((field) => field.name === 'Address') && (
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        onClick={() => handleAddOpenFieldValues('textfield', 'Address', false)}
                    >
                        <Plus size={32} /> Add Address
                    </MyButton>
                )}
                {!customFields
                    ?.filter((field) => field.status === 'ACTIVE')
                    ?.some((field) => field.name === 'Pincode') && (
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        onClick={() => handleAddOpenFieldValues('textfield', 'Pincode', false)}
                    >
                        <Plus size={32} /> Pincode
                    </MyButton>
                )}
                {!customFields
                    ?.filter((field) => field.status === 'ACTIVE')
                    ?.some((field) => field.name === 'Father Name') && (
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        onClick={() => handleAddOpenFieldValues('textfield', 'Father Name', false)}
                    >
                        <Plus size={32} /> Father Name
                    </MyButton>
                )}
                {!customFields
                    ?.filter((field) => field.status === 'ACTIVE')
                    ?.some((field) => field.name === 'Mother Name') && (
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        onClick={() => handleAddOpenFieldValues('textfield', 'Mother Name', false)}
                    >
                        <Plus size={32} /> Mother Name
                    </MyButton>
                )}
                {!customFields
                    ?.filter((field) => field.status === 'ACTIVE')
                    ?.some((field) => field.name === 'Parent Phone Number') && (
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        onClick={() =>
                            handleAddOpenFieldValues('textfield', 'Parent Phone Number', false)
                        }
                    >
                        <Plus size={32} /> Parent Phone Number
                    </MyButton>
                )}
                {!customFields
                    ?.filter((field) => field.status === 'ACTIVE')
                    ?.some((field) => field.name === 'Parent Email') && (
                    <MyButton
                        type="button"
                        scale="medium"
                        buttonType="secondary"
                        onClick={() => handleAddOpenFieldValues('textfield', 'Parent Email', false)}
                    >
                        <Plus size={32} /> Parent Email
                    </MyButton>
                )}

                <AddCustomFieldDialog
                    trigger={
                        <MyButton type="button" scale="medium" buttonType="secondary">
                            <Plus size={32} /> Add Custom Field
                        </MyButton>
                    }
                    onAddField={handleAddCustomField}
                    customFields={customFields || []}
                />
            </div>
        </div>
    );
};
