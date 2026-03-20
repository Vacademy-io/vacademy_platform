import { create } from 'zustand';
import { AssessmentSubmissionsBulkActionInfo } from '@/routes/manage-students/students-list/-types/bulk-actions-types';
import { SubmissionStudentData } from '@/types/assessments/assessment-overview';

interface AssessmentSubmissionsDialogStore {
    sendReminder: boolean;
    removeParticipants: boolean;
    selectedStudent: SubmissionStudentData | null;
    bulkActionInfo: AssessmentSubmissionsBulkActionInfo | null;
    isBulkAction: boolean;

    // Individual student actions
    openSendReminderDialog: (student: SubmissionStudentData) => void;
    openRemoveParticipantsDialog: (student: SubmissionStudentData) => void;

    // Bulk actions
    openBulkSendReminderDialog: (info: AssessmentSubmissionsBulkActionInfo) => void;
    openBulkRemoveParticipantsDialog: (info: AssessmentSubmissionsBulkActionInfo) => void;

    closeAllDialogs: () => void;
}

export const useSubmissionsBulkActionsDialogStorePending = create<AssessmentSubmissionsDialogStore>(
    (set) => ({
        sendReminder: false,
        removeParticipants: false,
        selectedStudent: null,
        bulkActionInfo: null,
        isBulkAction: false,

        // Individual student actions
        openSendReminderDialog: (student) =>
            set({
                sendReminder: true,
                removeParticipants: false,
                selectedStudent: student,
                bulkActionInfo: null,
                isBulkAction: false,
            }),

        openRemoveParticipantsDialog: (student) =>
            set({
                sendReminder: false,
                removeParticipants: true,
                selectedStudent: student,
                bulkActionInfo: null,
                isBulkAction: false,
            }),

        // Bulk actions
        openBulkSendReminderDialog: (info) =>
            set({
                sendReminder: true,
                removeParticipants: false,
                selectedStudent: null,
                bulkActionInfo: info,
                isBulkAction: true,
            }),

        openBulkRemoveParticipantsDialog: (info) =>
            set({
                sendReminder: false,
                removeParticipants: true,
                selectedStudent: null,
                bulkActionInfo: info,
                isBulkAction: true,
            }),

        closeAllDialogs: () =>
            set({
                sendReminder: false,
                removeParticipants: false,
                selectedStudent: null,
                bulkActionInfo: null,
                isBulkAction: false,
            }),
    })
);
