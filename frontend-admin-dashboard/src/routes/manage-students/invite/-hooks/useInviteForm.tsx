import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { inviteFormSchema, InviteForm, defaultFormValues } from '../-schema/InviteFormSchema';
import { DropdownOption } from '../-components/create-invite/AddCustomFieldDialog';
import { getCachedInstituteBranding } from '@/services/domain-routing';

export const useInviteForm = (initialValues?: InviteForm) => {
    const [copySuccess, setCopySuccess] = useState<string | null>(null);

    const domainRouting = getCachedInstituteBranding();
    const isPhoneAuth = domainRouting?.allowPhoneAuth === true;

    // Adjust default values based on phone auth
    const adjustedDefaultFormValues = { ...defaultFormValues };
    if (isPhoneAuth && adjustedDefaultFormValues.custom_fields) {
        adjustedDefaultFormValues.custom_fields = adjustedDefaultFormValues.custom_fields.map(cf => {
            if (cf.name === 'Email') {
                return { ...cf, isRequired: false };
            }
            return cf;
        });
    }

    // Initialize form
    const form = useForm<InviteForm>({
        resolver: zodResolver(inviteFormSchema),
        defaultValues: initialValues
            ? {
                inviteLink: initialValues.inviteLink,
                activeStatus: initialValues.activeStatus,
                custom_fields: initialValues.custom_fields,
                batches: initialValues.batches,
                studentExpiryDays: initialValues.studentExpiryDays,
                inviteeEmail: initialValues.inviteeEmail,
                inviteeEmails: initialValues.inviteeEmails,
            }
            : adjustedDefaultFormValues,
        mode: 'onChange',
    });
    const { setValue, getValues } = form;

    // Functions to handle custom fields
    const toggleIsRequired = (id: number) => {
        const customFields = getValues('custom_fields');
        const updatedFields = customFields?.map((field) =>
            field.id === id ? { ...field, isRequired: !field.isRequired } : field
        );
        setValue('custom_fields', updatedFields);
    };

    const handleAddOpenFieldValues = (
        type: string,
        name: string,
        oldKey: boolean,
        options?: DropdownOption[]
    ) => {
        const customFields = getValues('custom_fields');
        const updatedFields = [
            ...customFields,
            {
                id: customFields.length > 0 ? Math.max(...customFields.map((f) => f.id)) + 1 : 0,
                type,
                name,
                oldKey,
                isRequired: true,
                // This form's schema keys options by numeric id (unlike the string
                // ids used elsewhere) — re-index by position at the boundary.
                options: options?.map((opt, idx) => ({
                    id: idx,
                    value: opt.value,
                    disabled: opt.disabled ?? false,
                })),
                status: 'ACTIVE' as const,
            },
        ];

        // Update the form state with the new array
        setValue('custom_fields', updatedFields);
    };

    // Index-based: useFieldArray replaces each row's `id` with its own generated
    // key, so the schema's numeric id isn't reliably readable from the rendered
    // rows. The array index is unambiguous.
    const patchFieldAt = (index: number, patch: Record<string, unknown>) => {
        const customFields = getValues('custom_fields');
        const updatedFields = customFields?.map((field, idx) =>
            idx === index ? { ...field, ...patch } : field
        );
        setValue('custom_fields', updatedFields);
    };

    const handleUpdateFieldName = (index: number, name: string) => patchFieldAt(index, { name });

    const handleUpdateFieldOptions = (index: number, values: string[]) =>
        patchFieldAt(index, {
            options: values.map((value, idx) => ({ id: idx, value, disabled: false })),
        });

    const handleDeleteOpenField = (id: number) => {
        const customFields = getValues('custom_fields');
        const updatedFields = customFields?.map((field) =>
            field.id === id ? { ...field, status: 'DELETED' as const } : field
        );
        setValue('custom_fields', updatedFields);
    };

    const handleCopyClick = (link: string) => {
        navigator.clipboard
            .writeText(link)
            .then(() => {
                setCopySuccess(link);
                setTimeout(() => {
                    setCopySuccess(null);
                }, 2000);
            })
            .catch((err) => {
                console.log('Failed to copy link: ', err);
                toast.error('Copy failed');
            });
    };

    return {
        form,
        toggleIsRequired,
        handleAddOpenFieldValues,
        handleDeleteOpenField,
        handleUpdateFieldName,
        handleUpdateFieldOptions,
        handleCopyClick,
        copySuccess,
    };
};
