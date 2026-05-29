import { format } from 'date-fns';
import { useNavigate, useSearch } from '@tanstack/react-router';

/**
 * URL-driven view state for the Follow-ups page.
 *
 * Extracted into a hook so the page component stays small (CodeFactor's
 * cyclomatic-complexity check fired when this logic was inline). All sub-view
 * state lives on the URL so deep-links restore the same view.
 *
 *   view        — 'list' (default) | 'calendar'
 *   monthStr    — yyyy-MM (local) for the calendar's month
 *   selectedDateStr — yyyy-MM-dd (local) for the calendar's selected day
 *   counsellorFilter — userId, or the supplied `allValue` sentinel when "all"
 */
export type FollowUpsView = 'list' | 'calendar';

export interface FollowUpsViewState {
    view: FollowUpsView;
    setView: (v: FollowUpsView) => void;
    monthStr: string;
    setMonthStr: (m: string) => void;
    selectedDateStr: string;
    setSelectedDateStr: (d: string) => void;
    counsellorFilter: string;
    setCounsellorFilter: (v: string) => void;
}

export const useFollowUpsViewState = (allCounsellorsValue: string): FollowUpsViewState => {
    const search = useSearch({ from: '/audience-manager/follow-ups/' });
    const navigate = useNavigate({ from: '/audience-manager/follow-ups/' });

    const view: FollowUpsView = search.view ?? 'list';
    const monthStr = search.month ?? format(new Date(), 'yyyy-MM');
    const selectedDateStr = search.date ?? format(new Date(), 'yyyy-MM-dd');
    const counsellorFilter = search.counsellor ?? allCounsellorsValue;

    const setView = (v: FollowUpsView) =>
        navigate({ search: (prev) => ({ ...prev, view: v === 'list' ? undefined : v }) });
    const setMonthStr = (m: string) => navigate({ search: (prev) => ({ ...prev, month: m }) });
    const setSelectedDateStr = (d: string) =>
        navigate({ search: (prev) => ({ ...prev, date: d }) });
    const setCounsellorFilter = (v: string) =>
        navigate({
            search: (prev) => ({
                ...prev,
                counsellor: v === allCounsellorsValue ? undefined : v,
            }),
        });

    return {
        view,
        setView,
        monthStr,
        setMonthStr,
        selectedDateStr,
        setSelectedDateStr,
        counsellorFilter,
        setCounsellorFilter,
    };
};
