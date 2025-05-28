import { create } from 'zustand';
import { AssessmentSubmissionsBulkActionInfo } from '@/routes/manage-students/students-list/-types/bulk-actions-types';
import { SubmissionStudentData } from '@/types/assessments/assessment-overview';

interface AssessmentSubmissionsDialogStore {
    isProvideReattemptOpen: boolean;
    isProvideRevaluateAssessment: boolean;
    isProvideRevaluateQuestionWise: boolean;
    isReleaseResult: boolean;
    selectedStudent: SubmissionStudentData | null;
    bulkActionInfo: AssessmentSubmissionsBulkActionInfo | null;
    isBulkAction: boolean;

    // Individual student actions
    openProvideReattemptDialog: (student: SubmissionStudentData) => void;
    openProvideRevaluateAssessmentDialog: (student: SubmissionStudentData) => void;
    openProvideRevaluateQuestionWiseDialog: (student: SubmissionStudentData) => void;
    openProvideReleaseDialog: (student: SubmissionStudentData) => void;

    // Bulk actions
    openBulkProvideReattemptDialog: (info: AssessmentSubmissionsBulkActionInfo) => void;
    openBulkProvideRevaluateAssessmentDialog: (info: AssessmentSubmissionsBulkActionInfo) => void;
    openBulkProvideRevaluateQuestionWiseDialog: (info: AssessmentSubmissionsBulkActionInfo) => void;
    openBulkProvideReleaseDialog: (info: AssessmentSubmissionsBulkActionInfo) => void;

    closeAllDialogs: () => void;
}

export const useSubmissionsBulkActionsDialogStoreAttempted =
    create<AssessmentSubmissionsDialogStore>((set) => ({
        isProvideReattemptOpen: false,
        isProvideRevaluateAssessment: false,
        isProvideRevaluateQuestionWise: false,
        isReleaseResult: false,
        selectedStudent: null,
        bulkActionInfo: null,
        isBulkAction: false,

        // Individual student actions
        openProvideReattemptDialog: (student) =>
            set({
                isProvideReattemptOpen: true,
                isProvideRevaluateAssessment: false,
                isProvideRevaluateQuestionWise: false,
                isReleaseResult: false,
                selectedStudent: student,
                bulkActionInfo: null,
                isBulkAction: false,
            }),

        openProvideRevaluateAssessmentDialog: (student) =>
            set({
                isProvideReattemptOpen: false,
                isProvideRevaluateAssessment: true,
                isProvideRevaluateQuestionWise: false,
                isReleaseResult: false,
                selectedStudent: student,
                bulkActionInfo: null,
                isBulkAction: false,
            }),

        openProvideRevaluateQuestionWiseDialog: (student) =>
            set({
                isProvideReattemptOpen: false,
                isProvideRevaluateAssessment: false,
                isProvideRevaluateQuestionWise: true,
                isReleaseResult: true,
                selectedStudent: student,
                bulkActionInfo: null,
                isBulkAction: false,
            }),

        openProvideReleaseDialog: (student) =>
            set({
                isProvideReattemptOpen: false,
                isProvideRevaluateAssessment: false,
                isProvideRevaluateQuestionWise: false,
                isReleaseResult: true,
                selectedStudent: student,
                bulkActionInfo: null,
                isBulkAction: false,
            }),
        // Bulk actions
        openBulkProvideReattemptDialog: (info) =>
            set({
                isProvideReattemptOpen: true,
                isProvideRevaluateAssessment: false,
                isProvideRevaluateQuestionWise: false,
                isReleaseResult: false,
                selectedStudent: null,
                bulkActionInfo: info,
                isBulkAction: true,
            }),

        openBulkProvideRevaluateAssessmentDialog: (info) =>
            set({
                isProvideReattemptOpen: false,
                isProvideRevaluateAssessment: true,
                isProvideRevaluateQuestionWise: false,
                isReleaseResult: false,
                selectedStudent: null,
                bulkActionInfo: info,
                isBulkAction: true,
            }),

        openBulkProvideRevaluateQuestionWiseDialog: (info) =>
            set({
                isProvideReattemptOpen: false,
                isProvideRevaluateAssessment: false,
                isProvideRevaluateQuestionWise: true,
                isReleaseResult: false,
                selectedStudent: null,
                bulkActionInfo: info,
                isBulkAction: true,
            }),

        openBulkProvideReleaseDialog: (info) =>
            set({
                isProvideReattemptOpen: false,
                isProvideRevaluateAssessment: false,
                isProvideRevaluateQuestionWise: false,
                isReleaseResult: true,
                selectedStudent: null,
                bulkActionInfo: info,
                isBulkAction: true,
            }),

        closeAllDialogs: () =>
            set({
                isProvideReattemptOpen: false,
                isProvideRevaluateAssessment: false,
                isProvideRevaluateQuestionWise: false,
                isReleaseResult: false,
                selectedStudent: null,
                bulkActionInfo: null,
                isBulkAction: false,
            }),
    }));
