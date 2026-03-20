// stores/useDialogStore.ts
import { create } from 'zustand';
import { StudentTable } from '@/types/student-table-types';
import { BulkActionInfo } from '@/routes/manage-students/students-list/-types/bulk-actions-types';

interface DialogStore {
    isDeleteOpen: boolean;
    isIndividualShareCredentialsOpen: boolean;
    isShareCredentialsOpen: boolean;
    isSendMessageOpen: boolean;
    isSendEmailOpen: boolean;
    isAcceptRequestOpen: boolean;
    isDeclineRequestOpen: boolean;
    selectedStudent: StudentTable | null;
    bulkActionInfo: BulkActionInfo | null;
    isBulkAction: boolean;

    // Individual student actions
    openDeleteDialog: (student: StudentTable) => void;
    openIndividualShareCredentialsDialog: (student: StudentTable) => void;
    openIndividualSendMessageDialog: (student: StudentTable) => void;
    openIndividualSendEmailDialog: (student: StudentTable) => void;
    openIndividualAcceptRequestDialog: (student: StudentTable) => void;
    openIndividualDeclineRequestDialog: (student: StudentTable) => void;

    // Bulk actions
    openBulkDeleteDialog: (info: BulkActionInfo) => void;
    openBulkShareCredentialsDialog: (info: BulkActionInfo) => void;
    openBulkSendMessageDialog: (info: BulkActionInfo) => void;
    openBulkSendEmailDialog: (info: BulkActionInfo) => void;
    openBulkAcceptRequestDialog: (info: BulkActionInfo) => void;
    openBulkDeclineRequestDialog: (info: BulkActionInfo) => void;

    closeAllDialogs: () => void;
}

export const useEnrollRequestsDialogStore = create<DialogStore>((set) => ({
    isDeleteOpen: false,
    isIndividualShareCredentialsOpen: false,
    isShareCredentialsOpen: false,
    isSendMessageOpen: false,
    isSendEmailOpen: false,
    isAcceptRequestOpen: false,
    isDeclineRequestOpen: false,
    selectedStudent: null,
    bulkActionInfo: null,
    isBulkAction: false,

    // Individual student actions
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
    openIndividualSendMessageDialog: (student) =>
        set({
            isSendMessageOpen: true,
            selectedStudent: student,
            isBulkAction: false,
        }),
    openIndividualSendEmailDialog: (student) =>
        set({
            isSendEmailOpen: true,
            selectedStudent: student,
            isBulkAction: false,
        }),
    openIndividualAcceptRequestDialog: (student) =>
        set({
            isAcceptRequestOpen: true,
            selectedStudent: student,
            isBulkAction: false,
        }),
    openIndividualDeclineRequestDialog: (student) =>
        set({
            isDeclineRequestOpen: true,
            selectedStudent: student,
            isBulkAction: false,
        }),

    // Bulk actions
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
    openBulkSendMessageDialog: (info) =>
        set({
            isSendMessageOpen: true,
            bulkActionInfo: info,
            isBulkAction: true,
        }),
    openBulkSendEmailDialog: (info) =>
        set({
            isSendEmailOpen: true,
            bulkActionInfo: info,
            isBulkAction: true,
        }),
    openBulkAcceptRequestDialog: (info) =>
        set({
            isAcceptRequestOpen: true,
            bulkActionInfo: info,
            isBulkAction: true,
        }),
    openBulkDeclineRequestDialog: (info) =>
        set({
            isDeclineRequestOpen: true,
            bulkActionInfo: info,
            isBulkAction: true,
        }),

    closeAllDialogs: () =>
        set({
            isDeleteOpen: false,
            isIndividualShareCredentialsOpen: false,
            isShareCredentialsOpen: false,
            isSendMessageOpen: false,
            isSendEmailOpen: false,
            isAcceptRequestOpen: false,
            isDeclineRequestOpen: false,
            selectedStudent: null,
            bulkActionInfo: null,
            isBulkAction: false,
        }),
}));
