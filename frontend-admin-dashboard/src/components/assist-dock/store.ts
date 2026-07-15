import { create } from 'zustand';

/** Which slide-out panel (if any) the right Assist Dock currently shows. */
export type AssistPanel = 'none' | 'tutorials' | 'assistant' | 'support';

interface AssistDockState {
    panel: AssistPanel;
    setPanel: (panel: AssistPanel) => void;
    togglePanel: (panel: Exclude<AssistPanel, 'none'>) => void;
    /** The walkthrough currently open in the big viewer (null = closed). */
    activeTutorial: { file: string; title: string } | null;
    openTutorial: (file: string, title: string) => void;
    closeTutorial: () => void;
}

export const useAssistDock = create<AssistDockState>((set) => ({
    panel: 'none',
    setPanel: (panel) => set({ panel }),
    togglePanel: (panel) => set((s) => ({ panel: s.panel === panel ? 'none' : panel })),
    activeTutorial: null,
    openTutorial: (file, title) => set({ activeTutorial: { file, title } }),
    closeTutorial: () => set({ activeTutorial: null }),
}));
