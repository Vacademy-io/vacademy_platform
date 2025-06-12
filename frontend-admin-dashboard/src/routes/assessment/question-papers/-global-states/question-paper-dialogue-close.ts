import { create } from "zustand";

interface DialogState {
    isMainQuestionPaperAddDialogOpen: boolean;
    isManualQuestionPaperDialogOpen: boolean;
    isUploadFromDeviceDialogOpen: boolean;
    isSavedQuestionPaperDialogOpen: boolean;
    setIsMainQuestionPaperAddDialogOpen: (isOpen: boolean) => void;
    setIsManualQuestionPaperDialogOpen: (isOpen: boolean) => void;
    setIsUploadFromDeviceDialogOpen: (isOpen: boolean) => void;
    setIsSavedQuestionPaperDialogOpen: (isOpen: boolean) => void;
}

const useDialogStore = create<DialogState>((set) => ({
    isMainQuestionPaperAddDialogOpen: false,
    isManualQuestionPaperDialogOpen: false,
    isUploadFromDeviceDialogOpen: false,
    isSavedQuestionPaperDialogOpen: false,
    setIsMainQuestionPaperAddDialogOpen: (isOpen) =>
        set({ isMainQuestionPaperAddDialogOpen: isOpen }),
    setIsManualQuestionPaperDialogOpen: (isOpen) =>
        set({ isManualQuestionPaperDialogOpen: isOpen }),
    setIsUploadFromDeviceDialogOpen: (isOpen) => set({ isUploadFromDeviceDialogOpen: isOpen }),
    setIsSavedQuestionPaperDialogOpen: (isOpen) => set({ isSavedQuestionPaperDialogOpen: isOpen }),
}));

export default useDialogStore;
