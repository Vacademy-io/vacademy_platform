import { MyButton } from '@/components/design-system/button';
import { Share } from '@phosphor-icons/react';
import { EnrollBulkDialog } from './enroll-bulk-dialog';
import { MyDialog } from '@/components/design-system/dialog';
import { useState } from 'react';

export const EnrollBulkButton = () => {
    const [isOpen, setIsOpen] = useState(false);

    const handleOpenChange = (open: boolean) => setIsOpen(open);

    const bulkTrigger = (
        <MyButton buttonType="primary" scale="large" layoutVariant="default">
            <span>
                <Share />
            </span>
            Enroll in Bulk
        </MyButton>
    );

    return (
        <MyDialog
            heading="Enroll in Bulk"
            trigger={bulkTrigger}
            dialogId="enroll-bulk-dialog"
            onOpenChange={handleOpenChange}
            open={isOpen}
        >
            <EnrollBulkDialog />
        </MyDialog>
    );
};
