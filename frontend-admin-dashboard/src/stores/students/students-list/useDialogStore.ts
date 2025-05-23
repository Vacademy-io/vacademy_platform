import { create } from "zustand";

interface DialogState {
    isEnrollStudentsOpen: boolean;
    isEnrollBulkOpen: boolean;
    isCsvFormatOpen: boolean;
    isUploadCsvOpen: boolean;
    setEnrollStudentsOpen: (open: boolean) => void;
    setEnrollBulkOpen: (open: boolean) => void;
    setCsvFormatOpen: (open: boolean) => void;
    setUploadCsvOpen: (open: boolean) => void;
    closeAllDialogs: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
    isEnrollStudentsOpen: false,
    isEnrollBulkOpen: false,
    isCsvFormatOpen: false,
    isUploadCsvOpen: false,
    setEnrollStudentsOpen: (open) => set({ isEnrollStudentsOpen: open }),
    setEnrollBulkOpen: (open) => set({ isEnrollBulkOpen: open }),
    setCsvFormatOpen: (open) => set({ isCsvFormatOpen: open }),
    setUploadCsvOpen: (open) => set({ isUploadCsvOpen: open }),
    closeAllDialogs: () =>
        set({
            isEnrollStudentsOpen: false,
            isEnrollBulkOpen: false,
            isCsvFormatOpen: false,
            isUploadCsvOpen: false,
        }),
}));
