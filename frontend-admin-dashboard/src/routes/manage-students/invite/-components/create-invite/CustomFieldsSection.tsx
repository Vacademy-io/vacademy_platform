import { MyButton } from '@/components/design-system/button';
import { Switch } from '@/components/ui/switch';
import { DotsSixVertical, PencilSimple, Plus, TrashSimple } from '@phosphor-icons/react';
import { AddCustomFieldDialog, DropdownOption } from './AddCustomFieldDialog';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { InviteForm } from '../../-schema/InviteFormSchema';
import { MandatoryKeys } from '../../-utils/inviteLinkKeyChecks';
import { Sortable, SortableDragHandle, SortableItem } from '@/components/ui/sortable';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { InlineFieldEditor } from '@/components/common/custom-fields/InlineFieldEditor';
import {
    FormFieldRow,
    FormFieldRowHeader,
} from '@/components/common/custom-fields/FormFieldRow';
import { useState } from 'react';

interface CustomFieldsSectionProps {
    toggleIsRequired: (id: number) => void;
    handleAddOpenFieldValues: (
        type: string,
        name: string,
        oldKey: boolean,
        options?: DropdownOption[]
    ) => void;
    handleDeleteOpenField: (id: number) => void;
    handleUpdateFieldName: (index: number, name: string) => void;
    handleUpdateFieldOptions: (index: number, values: string[]) => void;
}

export const CustomFieldsSection = ({
    toggleIsRequired,
    handleAddOpenFieldValues,
    handleDeleteOpenField,
    handleUpdateFieldName,
    handleUpdateFieldOptions,
}: CustomFieldsSectionProps) => {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const { watch, control } = useFormContext<InviteForm>();
    const customFields = watch('custom_fields');
    const { fields, move } = useFieldArray({
        control,
        name: 'custom_fields',
        // keyName: RHF otherwise overwrites each row's `id` with a fresh uuid on
        // every array-level setValue, remounting rows (focus loss) and breaking
        // id-based matching. Keep the domain id intact.
        keyName: '_rhfKey',
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
            <div className="flex flex-col">
                <p className="text-title font-semibold">{`Form Fields (${fields.length})`}</p>
                <p className="text-caption text-neutral-500">Drag to reorder fields</p>
            </div>
            <FormFieldRowHeader />
            <Sortable
                value={fields}
                onMove={({ activeIndex, overIndex }) => {
                                    setEditingIndex(null);
                    move(activeIndex, overIndex);
                }}
                fast={false}
            >
                <div className="flex flex-col gap-4">
                    {fields.map((field, index) => {
                        const locked = field.oldKey || MandatoryKeys(field.name);
                        const isEditing = editingIndex === index;
                        const hasOptions =
                            field.type === 'dropdown' ||
                            field.type === 'radio' ||
                            field.type === 'multi_select';
                        return (
                            <SortableItem key={field.id} value={field.id} asChild>
                                <div className={field.status === 'DELETED' ? 'hidden' : ''}>
                                    <FormFieldRow
                                        position={index + 1}
                                        name={field.name}
                                        type={field.type}
                                        isRequired={field.isRequired}
                                        locked={locked}
                                        isEditing={isEditing}
                                        onToggleRequired={() => toggleIsRequired(field.id)}
                                        onEdit={() => setEditingIndex(isEditing ? null : index)}
                                        onDelete={() => {
                                                            setEditingIndex(null);
                                                            handleDeleteOpenField(field.id);
                                                        }}
                                        dragHandle={
                                            <SortableDragHandle
                                                variant="ghost"
                                                size="icon"
                                                className="cursor-grab"
                                                type="button"
                                            >
                                                <DotsSixVertical size={18} />
                                            </SortableDragHandle>
                                        }
                                    >
                                        <InlineFieldEditor
                                            name={field.name}
                                            onNameChange={(next) =>
                                                handleUpdateFieldName(index, next)
                                            }
                                            {...(hasOptions
                                                ? {
                                                      options: (field.options ?? []).map(
                                                          (o) => o.value
                                                      ),
                                                      onOptionsChange: (next: string[]) =>
                                                          handleUpdateFieldOptions(index, next),
                                                  }
                                                : {})}
                                        />
                                    </FormFieldRow>
                                </div>
                            </SortableItem>
                        );
                    })}
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
                                { id: '0', value: 'MALE', disabled: false },
                                { id: '1', value: 'FEMALE', disabled: false },
                                { id: '2', value: 'OTHER', disabled: false },
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
