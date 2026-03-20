// stores/pdfStore.ts
import { create } from "zustand";

interface PDFStore {
    pdfUrl: string | null;
    setPdfUrl: (url: string | null) => void;
}

export const usePDFStore = create<PDFStore>((set) => ({
    pdfUrl: null,
    setPdfUrl: (url) => set({ pdfUrl: url }),
}));
