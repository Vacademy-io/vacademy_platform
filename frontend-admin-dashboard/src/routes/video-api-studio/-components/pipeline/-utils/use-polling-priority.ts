import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Shared counter coordinating the `/status` polling cadence across every
 * mount that consumes `useVideoState`. When any component (typically a
 * detail sheet) registers itself as wanting "fast" polling, the global
 * priority flips to `fast` and the hook's `refetchInterval` drops from
 * 15s to 5s. The counter pattern lets multiple sheets coexist — fast
 * mode persists until the last fast consumer unmounts.
 *
 * Components opt in via `useRequestFastPolling(active)`. Hooks reading the
 * cadence read `usePollingPriorityValue()`. Plain store accessors are also
 * exposed for non-React contexts (the React Query refetchInterval callback
 * runs outside the React tree).
 */
interface PollingPriorityState {
    fastConsumers: number;
    increment: () => void;
    decrement: () => void;
}

const usePollingPriorityStore = create<PollingPriorityState>((set) => ({
    fastConsumers: 0,
    increment: () => set((s) => ({ fastConsumers: s.fastConsumers + 1 })),
    decrement: () => set((s) => ({ fastConsumers: Math.max(0, s.fastConsumers - 1) })),
}));

/**
 * Subscribe a component to "fast" polling. Pass `active=true` while the
 * component wants the 5s cadence (e.g. while a NodeDetailSheet is open).
 * The hook handles cleanup automatically on unmount or when `active`
 * toggles back to false.
 */
export function useRequestFastPolling(active: boolean): void {
    useEffect(() => {
        if (!active) return;
        const { increment, decrement } = usePollingPriorityStore.getState();
        increment();
        return () => decrement();
    }, [active]);
}

/** Read the current cadence priority reactively (re-renders on change). */
export function usePollingPriorityValue(): 'fast' | 'slow' {
    return usePollingPriorityStore((s) => (s.fastConsumers > 0 ? 'fast' : 'slow'));
}

/** Non-reactive read — for use inside React Query callbacks that run
 *  outside the React tree. */
export function readPollingPriority(): 'fast' | 'slow' {
    return usePollingPriorityStore.getState().fastConsumers > 0 ? 'fast' : 'slow';
}
