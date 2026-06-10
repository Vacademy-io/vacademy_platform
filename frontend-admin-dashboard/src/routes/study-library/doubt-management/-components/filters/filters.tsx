import { DateFilter } from './date-filter';
import { BatchFilter } from './batch-filter';
import { StatusFilter } from './status-filter';
import { TypeFilter } from './type-filter';
import { Funnel } from '@phosphor-icons/react';

export const Filters = () => {
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                <Funnel size={14} weight="duotone" className="text-primary-500" />
                Filters
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <StatusFilter />
                <TypeFilter />
                <BatchFilter />
                <DateFilter />
            </div>
        </div>
    );
};
