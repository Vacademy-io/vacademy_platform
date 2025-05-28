// stores/useDialogStore.ts
import { create } from 'zustand';
import { StudentTable } from '@/types/student-table-types';
import { BulkActionInfo } from '../-types/bulk-actions-types';

interface DialogStore {
    isChangeBatchOpen: boolean;
    isExtendSessionOpen: boolean;
    isReRegisterOpen: boolean;
    isTerminateRegistrationOpen: boolean;
    isDeleteOpen: boolean;
    isShareCredentialsOpen: boolean;
    isIndividualShareCredentialsOpen: boolean;
    selectedStudent: StudentTable | null;
    bulkActionInfo: BulkActionInfo | null;
    isBulkAction: boolean;

    // Individual student actions
    openChangeBatchDialog: (student: StudentTable) => void;
    openExtendSessionDialog: (student: StudentTable) => void;
    openReRegisterDialog: (student: StudentTable) => void;
    openTerminateRegistrationDialog: (student: StudentTable) => void;
    openDeleteDialog: (student: StudentTable) => void;
    openIndividualShareCredentialsDialog: (student: StudentTable) => void;

    // Bulk actions
    openBulkChangeBatchDialog: (info: BulkActionInfo) => void;
    openBulkExtendSessionDialog: (info: BulkActionInfo) => void;
    openBulkReRegisterDialog: (info: BulkActionInfo) => void;
    openBulkTerminateRegistrationDialog: (info: BulkActionInfo) => void;
    openBulkDeleteDialog: (info: BulkActionInfo) => void;
    openBulkShareCredentialsDialog: (info: BulkActionInfo) => void;

    closeAllDialogs: () => void;
}

export const useDialogStore = create<DialogStore>((set) => ({
    isChangeBatchOpen: false,
    isExtendSessionOpen: false,
    isReRegisterOpen: false,
    isTerminateRegistrationOpen: false,
    isDeleteOpen: false,
    isShareCredentialsOpen: false,
    isIndividualShareCredentialsOpen: false,
    selectedStudent: null,
    bulkActionInfo: null,
    isBulkAction: false,

    // Individual student actions
    openChangeBatchDialog: (student) =>
        set({
            isChangeBatchOpen: true,
            selectedStudent: student,
            isBulkAction: false,
        }),
    openExtendSessionDialog: (student) =>
        set({
            isExtendSessionOpen: true,
            selectedStudent: student,
            isBulkAction: false,
        }),
    openReRegisterDialog: (student) =>
        set({
            isReRegisterOpen: true,
            selectedStudent: student,
            isBulkAction: false,
        }),
    openTerminateRegistrationDialog: (student) =>
        set({
            isTerminateRegistrationOpen: true,
            selectedStudent: student,
            isBulkAction: false,
        }),
    openDeleteDialog: (student) =>
        set({
            isDeleteOpen: true,
            selectedStudent: student,
            isBulkAction: false,
        }),
    openIndividualShareCredentialsDialog: (student) =>
        set({
            isIndividualShareCredentialsOpen: true,
            selectedStudent: student,
            isBulkAction: false,
        }),

    // Bulk actions
    openBulkChangeBatchDialog: (info) =>
        set({
            isChangeBatchOpen: true,
            bulkActionInfo: info,
            isBulkAction: true,
        }),
    openBulkExtendSessionDialog: (info) =>
        set({
            isExtendSessionOpen: true,
            bulkActionInfo: info,
            isBulkAction: true,
        }),
    openBulkReRegisterDialog: (info) =>
        set({
            isReRegisterOpen: true,
            bulkActionInfo: info,
            isBulkAction: true,
        }),
    openBulkTerminateRegistrationDialog: (info) =>
        set({
            isTerminateRegistrationOpen: true,
            bulkActionInfo: info,
            isBulkAction: true,
        }),
    openBulkDeleteDialog: (info) =>
        set({
            isDeleteOpen: true,
            bulkActionInfo: info,
            isBulkAction: true,
        }),
    openBulkShareCredentialsDialog: (info) =>
        set({
            isShareCredentialsOpen: true,
            bulkActionInfo: info,
            isBulkAction: true,
        }),

    closeAllDialogs: () =>
        set({
            isChangeBatchOpen: false,
            isExtendSessionOpen: false,
            isReRegisterOpen: false,
            isTerminateRegistrationOpen: false,
            isDeleteOpen: false,
            isShareCredentialsOpen: false,
            isIndividualShareCredentialsOpen: false,
            selectedStudent: null,
            bulkActionInfo: null,
            isBulkAction: false,
        }),
}));
