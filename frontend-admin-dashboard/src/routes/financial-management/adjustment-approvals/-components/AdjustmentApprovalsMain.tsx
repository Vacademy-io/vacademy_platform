import { useState } from 'react';
import { cn } from '@/lib/utils';
import { PendingApprovalsTable } from './PendingApprovalsTable';
import { AdjustmentHistoryList } from './AdjustmentHistoryList';

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

const TABS: { key: Tab; label: string }[] = [
    { key: 'PENDING', label: 'Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: 'ALL', label: 'All History' },
];

export function AdjustmentApprovalsMain() {
    const [activeTab, setActiveTab] = useState<Tab>('PENDING');

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-gray-200">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setActiveTab(t.key)}
                        className={cn(
                            'px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
                            activeTab === t.key
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeTab === 'PENDING' && <PendingApprovalsTable />}
            {activeTab === 'APPROVED' && <AdjustmentHistoryList eventTypes={['APPROVED']} />}
            {activeTab === 'REJECTED' && <AdjustmentHistoryList eventTypes={['REJECTED']} />}
            {activeTab === 'ALL' && <AdjustmentHistoryList />}
        </div>
    );
}
