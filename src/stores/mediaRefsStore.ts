import { create } from 'zustand';

// Create a custom hook to manage media refs
export const useMediaRefsStore = create((set) => ({
  // State values
  currentPdfPage: 0,
  currentYoutubeTime: 0,
  currentUploadedVideoTime: 0,

  // Setters
  setCurrentPdfPage: (page: number) => set({ currentPdfPage: page }),
  setCurrentYoutubeTime: (time: number) => set({ currentYoutubeTime: time }),
  setCurrentUploadedVideoTime: (time: number) => set({ currentUploadedVideoTime: time }),
})); 