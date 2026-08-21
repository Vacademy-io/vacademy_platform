import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const INSTITUTE = 'inst-1';

const fetchMyMentorProfile = vi.fn();
let decodedToken: unknown = null;

vi.mock('@/constants/helper', () => ({
    getInstituteId: () => INSTITUTE,
}));

vi.mock('@/lib/auth/sessionUtility', () => ({
    getTokenFromCookie: () => 'token',
    getTokenDecodedData: () => decodedToken,
}));

vi.mock('@/routes/mentorship/-services/mentorship-service', () => ({
    fetchMyMentorProfile: (...args: unknown[]) => fetchMyMentorProfile(...args),
}));

import { useIsMentor } from '@/hooks/use-is-mentor';

const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const tokenWithRoles = (roles: string[], institute = INSTITUTE) => ({
    authorities: { [institute]: { roles, permissions: [] } },
});

describe('useIsMentor', () => {
    beforeEach(() => {
        fetchMyMentorProfile.mockReset();
        fetchMyMentorProfile.mockResolvedValue({ id: 'mentor-1' });
        decodedToken = null;
    });

    it('answers from the token without calling the API when the user is a mentor', async () => {
        decodedToken = tokenWithRoles(['ADMIN', 'MENTOR']);

        const { result } = renderHook(() => useIsMentor(), { wrapper });

        expect(result.current.isMentor).toBe(true);
        expect(result.current.isLoading).toBe(false);
        // The whole point: the sidebar must not hit mentorship on every page.
        expect(fetchMyMentorProfile).not.toHaveBeenCalled();
    });

    it('does not call the API when the caller disables it', async () => {
        decodedToken = tokenWithRoles(['ADMIN']);

        const { result } = renderHook(() => useIsMentor(false), { wrapper });

        expect(result.current.isMentor).toBe(false);
        expect(fetchMyMentorProfile).not.toHaveBeenCalled();
    });

    it('ignores a MENTOR role granted in a DIFFERENT institute', async () => {
        decodedToken = tokenWithRoles(['MENTOR'], 'other-institute');

        renderHook(() => useIsMentor(), { wrapper });

        // Not a mentor here, so it falls back to the probe rather than showing the entry.
        await waitFor(() => expect(fetchMyMentorProfile).toHaveBeenCalledWith(INSTITUTE));
    });

    it('falls back to the probe when the token has no mentor role', async () => {
        decodedToken = tokenWithRoles(['ADMIN']);

        const { result } = renderHook(() => useIsMentor(), { wrapper });

        await waitFor(() => expect(result.current.isMentor).toBe(true));
        expect(fetchMyMentorProfile).toHaveBeenCalledTimes(1);
    });

    it('reports not-a-mentor when the probe fails', async () => {
        decodedToken = tokenWithRoles(['ADMIN']);
        fetchMyMentorProfile.mockRejectedValue(new Error('not a mentor'));

        const { result } = renderHook(() => useIsMentor(), { wrapper });

        await waitFor(() => expect(fetchMyMentorProfile).toHaveBeenCalled());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.isMentor).toBe(false);
    });
});
