import { useState } from 'react';
import { MyButton } from '@/components/design-system/button';
import { UsersThree } from '@phosphor-icons/react';
import { BulkAssignDialog } from './bulk-assign-dialog/BulkAssignDialog';

interface Props {
    onSuccess?: () => void;
}

export const EnrollBulkButton = ({ onSuccess }: Props) => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <MyButton
                buttonType="secondary"
                scale="medium"
                layoutVariant="default"
                onClick={() => setOpen(true)}
            >
                <UsersThree size={16} className="mr-1.5" />
                Enroll in Bulk
            </MyButton>

            <BulkAssignDialog open={open} onOpenChange={setOpen} onSuccess={onSuccess} />
        </>
    );
};
