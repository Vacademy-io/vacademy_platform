import { create } from 'zustand';

interface DialogState {
    // Dialog open states
    isPdfDialogOpen: boolean;
    isDocUploadDialogOpen: boolean;
    isVideoDialogOpen: boolean;
    isVideoFileDialogOpen: boolean;
    isQuestionDialogOpen: boolean;
    isAssignmentDialogOpen: boolean;

    // Dialog actions
    openPdfDialog: () => void;
    closePdfDialog: () => void;
    togglePdfDialog: () => void;

    openDocUploadDialog: () => void;
    closeDocUploadDialog: () => void;
    toggleDocUploadDialog: () => void;

    openVideoDialog: () => void;
    closeVideoDialog: () => void;
    toggleVideoDialog: () => void;

    openVideoFileDialog: () => void;
    closeVideoFileDialog: () => void;
    toggleVideoFileDialog: () => void;

    openQuestionDialog: () => void;
    closeQuestionDialog: () => void;
    toggleQuestionDialog: () => void;

    openAssignmentDialog: () => void;
    closeAssignmentDialog: () => void;
    toggleAssignmentDialog: () => void;

    resetDialogs: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
    isPdfDialogOpen: false,
    isDocUploadDialogOpen: false,
    isVideoDialogOpen: false,
    isVideoFileDialogOpen: false,
    isQuestionDialogOpen: false,
    isAssignmentDialogOpen: false,

    // PDF Dialog actions
    openPdfDialog: () => set({ isPdfDialogOpen: true }),
    closePdfDialog: () => set({ isPdfDialogOpen: false }),
    togglePdfDialog: () => set((state) => ({ isPdfDialogOpen: !state.isPdfDialogOpen })),

    // Doc Upload Dialog actions
    openDocUploadDialog: () => set({ isDocUploadDialogOpen: true }),
    closeDocUploadDialog: () => set({ isDocUploadDialogOpen: false }),
    toggleDocUploadDialog: () =>
        set((state) => ({ isDocUploadDialogOpen: !state.isDocUploadDialogOpen })),

    // Video Dialog actions
    openVideoDialog: () => set({ isVideoDialogOpen: true }),
    closeVideoDialog: () => set({ isVideoDialogOpen: false }),
    toggleVideoDialog: () => set((state) => ({ isVideoDialogOpen: !state.isVideoDialogOpen })),

    // Video File Dialog actions
    openVideoFileDialog: () => set({ isVideoFileDialogOpen: true }),
    closeVideoFileDialog: () => set({ isVideoFileDialogOpen: false }),
    toggleVideoFileDialog: () =>
        set((state) => ({ isVideoFileDialogOpen: !state.isVideoFileDialogOpen })),

    // Question Dialog actions
    openQuestionDialog: () => set({ isQuestionDialogOpen: true }),
    closeQuestionDialog: () => set({ isQuestionDialogOpen: false }),
    toggleQuestionDialog: () =>
        set((state) => ({ isQuestionDialogOpen: !state.isQuestionDialogOpen })),

    // Assignment Dialog actions
    openAssignmentDialog: () => set({ isAssignmentDialogOpen: true }),
    closeAssignmentDialog: () => set({ isAssignmentDialogOpen: false }),
    toggleAssignmentDialog: () =>
        set((state) => ({ isAssignmentDialogOpen: !state.isAssignmentDialogOpen })),

    // Reset all dialogs
    resetDialogs: () =>
        set({
            isPdfDialogOpen: false,
            isDocUploadDialogOpen: false,
            isVideoDialogOpen: false,
            isVideoFileDialogOpen: false,
            isQuestionDialogOpen: false,
            isAssignmentDialogOpen: false,
        }),
}));
