import { ReactNode, useState } from 'react';
import { BulkDialogContext } from '../-context/bulk-dialog-context';

interface BulkDialogProviderProps {
    children: ReactNode;
}

export const BulkDialogProvider = ({ children }: BulkDialogProviderProps) => {
    const [enrollStudentDialogOpen, setEnrollStudentDialogOpen] = useState(false);
    const [selectBulkBatchDialogOpen, setSelectBulkBatchDialogOpen] = useState(false);
    const value = {
        enrollStudentDialogOpen,
        setEnrollStudentDialogOpen,
        selectBulkBatchDialogOpen,
        setSelectBulkBatchDialogOpen,
    };

    return <BulkDialogContext.Provider value={value}>{children}</BulkDialogContext.Provider>;
};
