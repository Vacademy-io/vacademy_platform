/**
 * Centralized lead-cache invalidation.
 *
 * Lead profile data is read by several disconnected surfaces (lead-profile drawer,
 * campaign-users table, recent-leads page, manage-contacts, manage-students). Any
 * action that affects a lead — adding a note/call/meeting, overriding the tier,
 * marking converted, assigning a counselor, enrolling — needs to invalidate every
 * one of those caches so the UI doesn't show stale scores.
 *
 * Use this helper everywhere instead of hand-rolling invalidations, so a future
 * cache key (or a new surface that reads lead data) only needs to be added in one
 * place.
 */

import { useQueryClient, type QueryClient } from '@tanstack/react-query';

/**
 * Invalidate every lead-related query for a given user.
 *
 * Pass the userId so the single-profile and timeline keys are scoped precisely;
 * the broader batch/list keys are invalidated wholesale because partial-key
 * invalidation isn't reliable across pages with different filter combinations.
 */
export function invalidateLeadCaches(queryClient: QueryClient, userId: string) {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: ['user-lead-profile', userId] });
    queryClient.invalidateQueries({ queryKey: ['lead-profiles-batch'] });
    queryClient.invalidateQueries({ queryKey: ['cross-stage-timeline', userId] });
    // Lead Journey timeline (lead-side-view → student-lead-profile) reads via
    // this key and shows journey + activity events together. Missing here
    // meant notes added from the Call History row didn't appear in Lead
    // Journey until manual refresh.
    queryClient.invalidateQueries({ queryKey: ['lead-all-events', userId] });
    queryClient.invalidateQueries({ queryKey: ['campaignUsers'] });
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['recent-leads'] });
    queryClient.invalidateQueries({ queryKey: ['user-audiences', userId] });
}

/**
 * Hook variant — convenience for components that already have queryClient via context.
 */
export function useInvalidateLeadCaches() {
    const queryClient = useQueryClient();
    return (userId: string) => invalidateLeadCaches(queryClient, userId);
}
