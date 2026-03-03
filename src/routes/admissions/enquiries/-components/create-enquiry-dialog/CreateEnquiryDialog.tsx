import React from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { CreateEnquiryForm } from './CreateEnquiryForm';

interface CreateEnquiryDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CreateEnquiryDialog: React.FC<CreateEnquiryDialogProps> = ({ isOpen, onClose }) => {
    return (
        <MyDialog
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            heading="Create Enquiry"
            dialogWidth="max-w-3xl"
        >
            <CreateEnquiryForm onSuccess={onClose} />
        </MyDialog>
    );
};
