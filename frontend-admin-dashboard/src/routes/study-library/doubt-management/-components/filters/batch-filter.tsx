import SelectChips from '@/components/design-system/SelectChips';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useEffect, useState } from 'react';
import { FilterType } from '../../-types/filter-type';
import { useDoubtFilters } from '../../-stores/filter-store';

const AllBatchOption = {
    label: 'All',
    value: '',
};

export const BatchFilter = () => {
    const { instituteDetails } = useInstituteDetailsStore();
    const { updateFilters } = useDoubtFilters();

    const batchList: FilterType[] = [];
    batchList?.push(AllBatchOption);
    const batches =
        instituteDetails?.batches_for_sessions.map((batch) => {
            return {
                label:
                    batch.level.level_name +
                        ' ' +
                        batch.package_dto.package_name +
                        ', ' +
                        batch.session.session_name || '',
                value: batch.id,
            };
        }) || [];
    batchList?.push(...batches);

    const [selectedBatch, setSelectedBatch] = useState<FilterType[]>([AllBatchOption]);

    const handleBatchChange = (batch: FilterType[]) => {
        if (batch.length > 0) setSelectedBatch(batch);
    };

    useEffect(() => {
        if (selectedBatch.includes(AllBatchOption)) {
            updateFilters({
                batch_ids: instituteDetails?.batches_for_sessions.map((batch) => batch.id) || [],
            });
        } else {
            updateFilters({
                batch_ids: selectedBatch.map((batch) => batch.value),
            });
        }
    }, [selectedBatch]);

    return (
        <div className="flex items-center gap-2">
            <p>Batch</p>
            <SelectChips
                options={batchList}
                selected={selectedBatch}
                onChange={handleBatchChange}
                multiSelect={true}
                hasClearFilter={false}
                className="min-w-40"
            />
        </div>
    );
};
