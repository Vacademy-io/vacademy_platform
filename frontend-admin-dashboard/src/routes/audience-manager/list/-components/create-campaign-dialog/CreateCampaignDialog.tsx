import React from 'react';
import { CreateCampaignForm } from './CreateCampaignForm';
import { CampaignItem } from '../../-services/get-campaigns-list';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface CreateCampaignDialogProps {
    isOpen: boolean;
    onClose: () => void;
    campaign?: CampaignItem | null;
}

export const CreateCampaignDialog: React.FC<CreateCampaignDialogProps> = ({
    isOpen,
    onClose,
    campaign,
}) => {
    const heading = campaign ? 'Edit Campaign' : 'Create Campaign';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{heading}</DialogTitle>
                </DialogHeader>
                <CreateCampaignForm onSuccess={onClose} campaign={campaign} />
            </DialogContent>
        </Dialog>
    );
};
