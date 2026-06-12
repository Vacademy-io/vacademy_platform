import { useEffect } from 'react';
import { Filters } from './filters/filters';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { DoubtInbox } from './inbox/doubt-inbox';
import { useDoubtFilters } from '../-stores/filter-store';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

export const DoubtManagement = () => {
    const { setNavHeading } = useNavHeadingStore();
    const { updateFilters } = useDoubtFilters();

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
            <DoubtInbox />
        </div>
    );
};
