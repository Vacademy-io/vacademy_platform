import { useEffect } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { Filters } from './filters/filters';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { DoubtInbox } from './inbox/doubt-inbox';
import { useDoubtFilters } from '../-stores/filter-store';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

const routeApi = getRouteApi('/study-library/doubt-management/');

export const DoubtManagement = () => {
    const { setNavHeading } = useNavHeadingStore();
    const { updateFilters } = useDoubtFilters();
    // Deep link from doubt-notification emails/alerts: open this specific doubt in the inbox.
    const { doubtId } = routeApi.useSearch();

    useEffect(() => {
        setNavHeading('Doubt Management');
        // Scope the inbox to the current institute so batchless general queries are visible and the
        // backend doesn't have to enumerate every batch.
        const instituteId = getCurrentInstituteId();
        if (instituteId) updateFilters({ institute_id: instituteId });
    }, []);

    return (
        <div className="flex flex-col gap-4">
            <Filters />
            <DoubtInbox initialDoubtId={doubtId} />
        </div>
    );
};
