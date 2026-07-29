import { useState } from 'react';
import { cn } from '@/lib/utils';
import BatchFilter, { ALL_BATCHES } from './BatchFilter';
import OverviewView from './OverviewView';
import ContentMapView from './ContentMapView';
import LiveClassesView from './LiveClassesView';
import AssessmentsView from './AssessmentsView';
import FeedView from './FeedView';

type PulseView = 'OVERVIEW' | 'CONTENT' | 'CLASSES' | 'ASSESSMENTS' | 'FEED';

const VIEWS: { value: PulseView; label: string }[] = [
    { value: 'OVERVIEW', label: 'Overview' },
    { value: 'CONTENT', label: 'Content' },
    { value: 'CLASSES', label: 'Live Classes' },
    { value: 'ASSESSMENTS', label: 'Assessments' },
    { value: 'FEED', label: 'Live Feed' },
];

export default function InstitutePulseTab({ instituteId }: { instituteId: string }) {
    const [view, setView] = useState<PulseView>('OVERVIEW');

    // Batch scope is page-level and applied SERVER-side. Filtering the response on the client
    // would be wrong now that every rail is paginated: page 0 holds 10 institute-wide rows, so a
    // client filter could show nothing while matching rows sit on page 3 — and the totals are
    // server-computed institute-wide aggregates the UI cannot recompute from a page.
    const [batch, setBatch] = useState<string>(ALL_BATCHES);
    const scope = batch === ALL_BATCHES ? '' : batch;

    if (!instituteId) {
        return (
            <div className="rounded-md bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
                No institute selected.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-1">
                    {VIEWS.map((v) => (
                        <button
                            key={v.value}
                            type="button"
                            onClick={() => setView(v.value)}
                            className={cn(
                                'shrink-0 rounded-md px-3.5 py-1.5 text-sm transition-colors',
                                view === v.value
                                    ? 'bg-white font-semibold text-neutral-800 shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-700'
                            )}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>

                <BatchFilter value={batch} onChange={setBatch} />
            </div>

            {/* Each view owns its own poll and is enabled only while mounted, so only the visible
                rail hits the backend. Overview is the exception: it deliberately subscribes to
                three rails at once for the KPI strip, and degrades per-rail if one fails. */}
            {view === 'OVERVIEW' && <OverviewView instituteId={instituteId} scope={scope} />}
            {view === 'CONTENT' && <ContentMapView instituteId={instituteId} scope={scope} />}
            {view === 'CLASSES' && <LiveClassesView instituteId={instituteId} scope={scope} />}
            {view === 'ASSESSMENTS' && <AssessmentsView instituteId={instituteId} scope={scope} />}
            {view === 'FEED' && <FeedView instituteId={instituteId} scope={scope} />}
        </div>
    );
}
