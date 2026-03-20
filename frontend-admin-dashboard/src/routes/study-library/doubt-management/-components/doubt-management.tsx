import { useEffect } from 'react';
import { Filters } from './filters/filters';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { DoubtTable } from './doubt-table/doubt-table';

export const DoubtManagement = () => {
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading('Doubt Management');
    }, []);

    return (
        <div className="flex flex-col gap-4 sm:gap-8">
            <Filters />
            <DoubtTable />
        </div>
    );
};
