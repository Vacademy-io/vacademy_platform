import { useEffect } from 'react';
import { create } from 'zustand';
import type { LeadProfileSummary } from '@/hooks/use-lead-profiles';
import type { LeadActionHandlers } from './lead-actions';
import type { LeadCardVM } from './lead-view-model';

/**
 * The lead list the side panel was opened from: the rows on the current page, their
 * profiles and the page's own action handlers. The enhanced lead side panel uses it
 * for Previous / Next and the quick actions, so every action runs exactly as it does
 * from the row. A lead opened from anywhere else (learners, admissions) finds no
 * matching row here, and the panel stays hidden.
 */
export interface LeadDrawerSource {
    vms: LeadCardVM[];
    profiles: Record<string, LeadProfileSummary>;
    actions: LeadActionHandlers;
    showOps: boolean;
    showScore: boolean;
}

interface LeadDrawerSourceState {
    source: LeadDrawerSource | null;
    setSource: (source: LeadDrawerSource | null) => void;
}

export const useLeadDrawerSourceStore = create<LeadDrawerSourceState>((set) => ({
    source: null,
    setSource: (source) => set({ source }),
}));

/** Register a lead page's rows while it is mounted. */
export function useRegisterLeadDrawerSource(source: LeadDrawerSource) {
    const setSource = useLeadDrawerSourceStore((s) => s.setSource);
    const { vms, profiles, actions, showOps, showScore } = source;
    useEffect(() => {
        const next = { vms, profiles, actions, showOps, showScore };
        setSource(next);
        return () => {
            if (useLeadDrawerSourceStore.getState().source === next) setSource(null);
        };
    }, [vms, profiles, actions, showOps, showScore, setSource]);
}
