import { create } from 'zustand';
import type { z } from 'zod';
import { sessionFormSchema } from '../-schema/schema';

interface LiveSessionStep1State {
    sessionId: string;
    isEdit: boolean;
    step1Data: z.infer<typeof sessionFormSchema> | null;
    /**
     * When step 1 was submitted in Bulk mode this holds every sessionId that
     * was just created. Step 2 fans out the participants/access payload to all
     * of them on submit. Empty in single-session flow.
     */
    bulkSessionIds: string[];
    setIsEdit: (isEdit: boolean) => void;
    setSessionId: (id: string) => void;
    setStep1Data: (data: z.infer<typeof sessionFormSchema>) => void;
    setBulkSessionIds: (ids: string[]) => void;
    clearSessionId: () => void;
    clearStep1Data: () => void;
    clearBulkSessionIds: () => void;
}

export const useLiveSessionStore = create<LiveSessionStep1State>((set) => ({
    sessionId: '',
    isEdit: false,
    step1Data: null,
    bulkSessionIds: [],
    setIsEdit: (isEdit: boolean) => set({ isEdit }),
    setSessionId: (id: string) => set({ sessionId: id }),
    setStep1Data: (data) => set({ step1Data: data }),
    setBulkSessionIds: (ids) => set({ bulkSessionIds: ids }),
    clearSessionId: () => set({ sessionId: '', isEdit: false }),
    clearStep1Data: () => set({ step1Data: null }),
    clearBulkSessionIds: () => set({ bulkSessionIds: [] }),
}));
