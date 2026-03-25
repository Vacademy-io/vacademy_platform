import { create } from 'zustand';
import type { z } from 'zod';
import { sessionFormSchema } from '../-schema/schema';

interface LiveSessionStep1State {
    sessionId: string;
    isEdit: boolean;
    step1Data: z.infer<typeof sessionFormSchema> | null;
    setIsEdit: (isEdit: boolean) => void;
    setSessionId: (id: string) => void;
    setStep1Data: (data: z.infer<typeof sessionFormSchema>) => void;
    clearSessionId: () => void;
    clearStep1Data: () => void;
}

export const useLiveSessionStore = create<LiveSessionStep1State>((set) => ({
    sessionId: '',
    isEdit: false,
    step1Data: null,
    setIsEdit: (isEdit: boolean) => set({ isEdit }),
    setSessionId: (id: string) => set({ sessionId: id }),
    setStep1Data: (data) => set({ step1Data: data }),
    clearSessionId: () => set({ sessionId: '', isEdit: false }),
    clearStep1Data: () => set({ step1Data: null }),
}));
