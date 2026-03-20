import React, { useState, useEffect } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';

interface EditLiveLinkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentLink: string;
    onUpdate: (newLink: string) => void;
}

const EditLiveLinkDialog: React.FC<EditLiveLinkDialogProps> = ({
    open,
    onOpenChange,
    currentLink,
    onUpdate,
}) => {
    const [newLink, setNewLink] = useState('');

    useEffect(() => {
        if (!open) {
            setNewLink('');
        }
    }, [open]);

    return (
        <MyDialog open={open} onOpenChange={onOpenChange} heading="Edit Live Class Link" dialogWidth="w-[400px]">
            <div className="flex flex-col gap-4 p-4">
                <div>
                    <label className="text-sm font-medium mb-1">Current Link</label>
                    <input
                        type="text"
                        className="rounded border bg-gray-50 px-2 py-1 text-sm w-full"
                        value={currentLink}
                        readOnly
                    />
                </div>
                <div>
                    <label className="text-sm font-medium mb-1">New Link</label>
                    <input
                        type="text"
                        className="rounded border bg-gray-50 px-2 py-1 text-sm w-full"
                        value={newLink}
                        onChange={(e) => setNewLink(e.target.value)}
                        placeholder="Enter new link"
                    />
                </div>
                <div className="flex justify-end gap-2 mt-4">
                    <MyButton onClick={() => onOpenChange(false)}>Cancel</MyButton>
                    <MyButton onClick={() => onUpdate(newLink)} disable={!newLink} buttonType="primary">
                        Update
                    </MyButton>
                </div>
            </div>
        </MyDialog>
    );
};

export default EditLiveLinkDialog;
