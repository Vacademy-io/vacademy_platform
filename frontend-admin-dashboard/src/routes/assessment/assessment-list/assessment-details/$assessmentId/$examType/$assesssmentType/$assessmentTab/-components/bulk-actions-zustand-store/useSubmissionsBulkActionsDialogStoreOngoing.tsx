import { create } from 'zustand';
import { AssessmentSubmissionsBulkActionInfo } from '@/routes/manage-students/students-list/-types/bulk-actions-types';
import { SubmissionStudentData } from '@/types/assessments/assessment-overview';

interface AssessmentSubmissionsDialogStore {
    increaseAssessmentTime: boolean;
    closeSubmission: boolean;
    selectedStudent: SubmissionStudentData | null;
    bulkActionInfo: AssessmentSubmissionsBulkActionInfo | null;
    isBulkAction: boolean;

    // Individual student actions
    openIncreaseAssessmentTimeDialog: (student: SubmissionStudentData) => void;
    openCloseSubmissionDialog: (student: SubmissionStudentData) => void;

    // Bulk actions
    openBulkIncreaseAssessmentTimeDialog: (info: AssessmentSubmissionsBulkActionInfo) => void;
    openBulkCloseSubmissionDialog: (info: AssessmentSubmissionsBulkActionInfo) => void;

    closeAllDialogs: () => void;
}

export const useSubmissionsBulkActionsDialogStoreOngoing = create<AssessmentSubmissionsDialogStore>(
    (set) => ({
        increaseAssessmentTime: false,
        closeSubmission: false,
        selectedStudent: null,
        bulkActionInfo: null,
        isBulkAction: false,

        // Individual student actions
        openIncreaseAssessmentTimeDialog: (student) =>
            set({
                increaseAssessmentTime: true,
                closeSubmission: false,
                selectedStudent: student,
                bulkActionInfo: null,
                isBulkAction: false,
            }),

        openCloseSubmissionDialog: (student) =>
            set({
                increaseAssessmentTime: false,
                closeSubmission: true,
                selectedStudent: student,
                bulkActionInfo: null,
                isBulkAction: false,
            }),

        // Bulk actions
        openBulkIncreaseAssessmentTimeDialog: (info) =>
            set({
                increaseAssessmentTime: true,
                closeSubmission: false,
                selectedStudent: null,
                bulkActionInfo: info,
                isBulkAction: true,
            }),

        openBulkCloseSubmissionDialog: (info) =>
            set({
                increaseAssessmentTime: false,
                closeSubmission: true,
                selectedStudent: null,
                bulkActionInfo: info,
                isBulkAction: true,
            }),

        closeAllDialogs: () =>
            set({
                increaseAssessmentTime: false,
                closeSubmission: false,
                selectedStudent: null,
                bulkActionInfo: null,
                isBulkAction: false,
            }),
    })
);
