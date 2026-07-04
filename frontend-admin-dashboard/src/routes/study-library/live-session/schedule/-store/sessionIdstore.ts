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
    /**
     * Deep-link context set when the schedule flow is opened from another page
     * (e.g. the Course Details → Live Sessions tab). `preselectedBatchIds` seed
     * the batch selection in Step 2, and `returnUrl` is where we navigate after
     * a successful create instead of the default live-session list. Both survive
     * the schedule dispatcher → step1 redirect and are cleared on create/exit.
     */
    preselectedBatchIds: string[];
    returnUrl: string | null;
    setIsEdit: (isEdit: boolean) => void;
    setSessionId: (id: string) => void;
    setStep1Data: (data: z.infer<typeof sessionFormSchema>) => void;
    setBulkSessionIds: (ids: string[]) => void;
    setDeepLink: (deepLink: { preselectedBatchIds: string[]; returnUrl: string | null }) => void;
    clearSessionId: () => void;
    clearStep1Data: () => void;
    clearBulkSessionIds: () => void;
    clearDeepLink: () => void;
}

export const useLiveSessionStore = create<LiveSessionStep1State>((set) => ({
    sessionId: '',
    isEdit: false,
    step1Data: null,
    bulkSessionIds: [],
    preselectedBatchIds: [],
    returnUrl: null,
    setIsEdit: (isEdit: boolean) => set({ isEdit }),
    setSessionId: (id: string) => set({ sessionId: id }),
    setStep1Data: (data) => set({ step1Data: data }),
    setBulkSessionIds: (ids) => set({ bulkSessionIds: ids }),
    setDeepLink: ({ preselectedBatchIds, returnUrl }) =>
        set({ preselectedBatchIds, returnUrl }),
    clearSessionId: () => set({ sessionId: '', isEdit: false }),
    clearStep1Data: () => set({ step1Data: null }),
    clearBulkSessionIds: () => set({ bulkSessionIds: [] }),
    clearDeepLink: () => set({ preselectedBatchIds: [], returnUrl: null }),
}));
