import SelectChips from '@/components/design-system/SelectChips';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterType } from '../../-types/filter-type';
import { useDoubtFilters } from '../../-stores/filter-store';

export const StatusFilter = () => {
    const { t } = useTranslation('studyLibraryStatusFilter');
    const { updateFilters } = useDoubtFilters();

    const statusFilterList: FilterType[] = useMemo(
        () => [
            {
                label: t('options.all'),
                value: 'ACTIVE,RESOLVED',
            },
            {
                label: t('options.resolved'),
                value: 'RESOLVED',
            },
            {
                label: t('options.unresolved'),
                value: 'ACTIVE',
            },
        ],
        [t]
    );

    const [selectedStatus, setSelectedStatus] = useState([statusFilterList[0]!]);

    const handleStatusChange = (status: FilterType[]) => {
        setSelectedStatus(status);
    };

    useEffect(() => {
        updateFilters({
            status: selectedStatus.flatMap((status) => status.value.split(',')),
        });
    }, [selectedStatus]);

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-600">{t('label.status')}</span>
            <SelectChips
                options={statusFilterList}
                selected={selectedStatus}
                onChange={handleStatusChange}
                hasClearFilter={false}
                className="min-w-40"
            />
        </div>
    );
};
