// Bulk Content Uploading — course-page entry: button + near-fullscreen dialog
// hosting the shared wizard with the course context prefilled.

import { useState } from 'react';
import { FileArchive } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { useBulkContentUploadingStore } from './use-bulk-content-uploading-store';
import { BulkContentUploadingWizard } from './bulk-content-uploading-wizard';
import type { BulkUploadContext } from './types';

interface BulkUploadDialogButtonProps {
    context: BulkUploadContext;
    onCompleted?: () => void;
}

export const BulkUploadDialogButton = ({ context, onCompleted }: BulkUploadDialogButtonProps) => {
    const [open, setOpen] = useState(false);
    const phase = useBulkContentUploadingStore((state) => state.phase);

    const handleOpenChange = (next: boolean) => {
        // Don't silently kill an in-flight run on outside-click/Escape.
        if (!next && phase === 'committing') {
            const confirmed = window.confirm(
                'Upload is still in progress. Closing now stops the remaining items (completed slides are kept). Close anyway?'
            );
            if (!confirmed) return;
        }
        setOpen(next);
    };

    return (
        <>
            <MyButton
                buttonType="secondary"
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 !px-3 !py-1 text-xs"
            >
                <FileArchive size={14} weight="bold" />
                Bulk Upload (ZIP)
            </MyButton>
            <MyDialog
                heading="Bulk Content Upload"
                open={open}
                onOpenChange={handleOpenChange}
                dialogWidth="max-w-5xl"
            >
                {open && <BulkContentUploadingWizard context={context} onCompleted={onCompleted} />}
            </MyDialog>
        </>
    );
};
