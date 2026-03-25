// updated-useBulkUploadStore.ts
import { create } from 'zustand';
import {
    SchemaFields,
    ValidationError,
} from '@/routes/manage-students/students-list/-types/bulk-upload-types';
import { validateCellValue } from '@/routes/manage-students/students-list/-components/enroll-bulk/bulk-upload-table';
import { Header } from '@/routes/manage-students/students-list/-schemas/student-bulk-enroll/csv-bulk-init';

interface BulkUploadStoreState {
    csvData: SchemaFields[] | undefined;
    csvErrors: ValidationError[];
    isEditing: boolean;
    setCsvData: (data: SchemaFields[] | undefined) => void;
    setCsvErrors: (errors: ValidationError[]) => void;
    setIsEditing: (value: boolean) => void;
    updateCellValue: (rowIndex: number, columnId: string, value: string) => void;
    validateRows: () => void;
    validateSingleCell: (rowIndex: number, columnId: string, value: string, header: Header) => void;
}

export const useBulkUploadStore = create<BulkUploadStoreState>((set, get) => ({
    csvData: undefined,
    csvErrors: [],
    isEditing: false,
    setCsvData: (data) => set({ csvData: data }),
    setCsvErrors: (errors) => set({ csvErrors: errors }),
    setIsEditing: (value) => set({ isEditing: value }),
    updateCellValue: (rowIndex, columnId, value) => {
        const { csvData } = get();
        if (!csvData) return;

        const newData = [...csvData];
        if (newData[rowIndex]) {
            newData[rowIndex] = {
                ...newData[rowIndex],
                [columnId]: value,
            };
            set({ csvData: newData });
        }
    },
    validateRows: () => {
        // This would be implemented with validation logic
        // based on the headers and data
        // For now it's a placeholder for future implementation
    },
    validateSingleCell: (rowIndex, columnId, value, header) => {
        const { csvErrors } = get();

        // Remove existing errors for this cell
        const filteredErrors = csvErrors.filter(
            (error) => !(error.path[0] === rowIndex && error.path[1] === columnId)
        );

        // Validate the new value
        const cellError = validateCellValue(value, header, rowIndex);

        // Update errors state
        set({
            csvErrors: cellError ? [...filteredErrors, cellError] : filteredErrors,
        });
    },
}));
