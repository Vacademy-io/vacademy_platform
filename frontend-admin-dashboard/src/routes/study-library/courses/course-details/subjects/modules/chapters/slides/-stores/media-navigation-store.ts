import { create } from 'zustand';

interface MediaNavigationStore {
    // Video navigation
    videoSeekTime: number | null;
    setVideoSeekTime: (time: number) => void;
    clearVideoSeekTime: () => void;

    // PDF navigation
    pdfPageNumber: number | null;
    setPdfPageNumber: (page: number) => void;
    clearPdfPageNumber: () => void;

    // General navigation action
    navigateToTimestamp: (timestamp: number, mediaType: 'VIDEO' | 'DOCUMENT') => void;

    // Reset all navigation states
    resetMediaNavigation: () => void;
}

export const useMediaNavigationStore = create<MediaNavigationStore>((set) => ({
    videoSeekTime: null,
    pdfPageNumber: null,

    setVideoSeekTime: (time) => set({ videoSeekTime: time }),
    clearVideoSeekTime: () => set({ videoSeekTime: null }),

    setPdfPageNumber: (page) => set({ pdfPageNumber: page }),
    clearPdfPageNumber: () => set({ pdfPageNumber: null }),

    navigateToTimestamp: (timestamp, mediaType) => {
        if (mediaType === 'VIDEO') {
            // Convert seconds to milliseconds if needed, but video.currentTime expects seconds
            set({ videoSeekTime: timestamp / 1000, pdfPageNumber: null });
        } else if (mediaType === 'DOCUMENT') {
            // For PDF, timestamp is 0-based but we want 1-based page numbers
            set({ pdfPageNumber: timestamp + 1, videoSeekTime: null });
        }
    },

    resetMediaNavigation: () => set({ videoSeekTime: null, pdfPageNumber: null }),
}));
