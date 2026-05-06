import { AddCustomFieldDialog as SharedAddCustomFieldDialog } from '@/components/common/custom-fields/AddCustomFieldDialog';
import type { DropdownOption } from '@/components/common/custom-fields/AddCustomFieldDialog';
import { CustomField } from '../../-schema/InviteFormSchema';

export type { DropdownOption };

interface AddCustomFieldDialogProps {
    trigger: React.ReactNode;
    onAddField: (type: string, name: string, oldKey: boolean, options?: DropdownOption[]) => void;
    customFields: CustomField[];
}

export const AddCustomFieldDialog = ({
    trigger,
    onAddField,
    customFields,
}: AddCustomFieldDialogProps) => {
    // Only consider ACTIVE fields as duplicates — admins should be able to
    // re-add a field they previously deleted in the same dialog session.
    const existingFieldNames = customFields
        .filter((f) => (f as any).status !== 'DELETED')
        .map((f) => f.name);

    return (
        <SharedAddCustomFieldDialog
            trigger={trigger}
            onAddField={(type, name, oldKey, options) => {
                onAddField(type, name, oldKey, options);
            }}
            existingFieldNames={existingFieldNames}
        />
    );
};
