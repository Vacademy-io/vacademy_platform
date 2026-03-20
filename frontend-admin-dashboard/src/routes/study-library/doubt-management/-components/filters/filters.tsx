import { DateFilter } from './date-filter';
import { BatchFilter } from './batch-filter';
import { StatusFilter } from './status-filter';

export const Filters = () => {
    return (
        <div className="flex flex-wrap items-center gap-4">
            <StatusFilter />
            <BatchFilter />
            <DateFilter />
        </div>
    );
};
