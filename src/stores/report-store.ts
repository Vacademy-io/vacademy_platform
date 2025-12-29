import { create } from "zustand";
import { StudentReport } from "@/services/student-reports-api";

interface ReportStore {
  selectedReport: StudentReport | null;
  setSelectedReport: (report: StudentReport) => void;
  clearSelectedReport: () => void;
}

export const useReportStore = create<ReportStore>((set) => ({
  selectedReport: null,
  setSelectedReport: (report) => set({ selectedReport: report }),
  clearSelectedReport: () => set({ selectedReport: null }),
}));
