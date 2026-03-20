import { createContext, useContext } from 'react';

interface BulkDialogContextType {
    enrollStudentDialogOpen: boolean;
    setEnrollStudentDialogOpen: (open: boolean) => void;
    selectBulkBatchDialogOpen: boolean;
    setSelectBulkBatchDialogOpen: (open: boolean) => void;
}

export const BulkDialogContext = createContext<BulkDialogContextType | undefined>(undefined);

export const useBulkDialog = () => {
    const context = useContext(BulkDialogContext);
    if (!context) {
        throw new Error('useBulkDialog must be used within a BulkDialogProvider');
    }
    return context;
};
