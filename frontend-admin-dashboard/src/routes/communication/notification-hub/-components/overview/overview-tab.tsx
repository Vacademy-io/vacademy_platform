import { useCallback, useEffect, useState } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';
import { getInstituteId } from '@/constants/helper';
import { StatsCards } from './stats-cards';
import { RecentActivity } from './recent-activity';
import {
    getHubOverview,
    getHubRecent,
    type HubOverview,
    type HubRecentItem,
} from '../../-services/hub-api';

const WINDOW_OPTIONS = [
    { label: 'Last 24h', days: 1 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
];

const RECENT_PAGE_SIZE = 20;

export function OverviewTab() {
    const instituteId = getInstituteId() || '';
    const [windowDays, setWindowDays] = useState(7);
    const [overview, setOverview] = useState<HubOverview | null>(null);
    const [recent, setRecent] = useState<HubRecentItem[]>([]);
    const [recentOffset, setRecentOffset] = useState(0);
    const [hasMoreRecent, setHasMoreRecent] = useState(false);
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [loadingRecent, setLoadingRecent] = useState(false);
    const [loadingMoreRecent, setLoadingMoreRecent] = useState(false);

    const load = useCallback(async () => {
        if (!instituteId) return;
        setLoadingOverview(true);
        setLoadingRecent(true);
        try {
            const [o, r] = await Promise.all([
                getHubOverview(instituteId, windowDays),
                getHubRecent(instituteId, RECENT_PAGE_SIZE, 0),
            ]);
            setOverview(o);
            setRecent(r);
            setRecentOffset(r.length);
            setHasMoreRecent(r.length >= RECENT_PAGE_SIZE);
        } catch (err) {
            console.error('Failed to load hub overview', err);
        } finally {
            setLoadingOverview(false);
            setLoadingRecent(false);
        }
    }, [instituteId, windowDays]);

    const loadMoreRecent = useCallback(async () => {
        if (loadingMoreRecent || !hasMoreRecent || !instituteId) return;
        setLoadingMoreRecent(true);
        try {
            const more = await getHubRecent(instituteId, RECENT_PAGE_SIZE, recentOffset);
            if (more.length === 0) {
                setHasMoreRecent(false);
            } else {
                // Dedup by id in case a recent send appears in both the polled head and the
                // newly-fetched page (unlikely with offset, but cheap to guard).
                setRecent((prev) => {
                    const seen = new Set(prev.map((i) => i.id));
                    const additions = more.filter((i) => !seen.has(i.id));
                    return [...prev, ...additions];
                });
                setRecentOffset((prev) => prev + more.length);
                setHasMoreRecent(more.length >= RECENT_PAGE_SIZE);
            }
        } catch (err) {
            console.error('Failed to load more recent activity', err);
        } finally {
            setLoadingMoreRecent(false);
        }
    }, [hasMoreRecent, instituteId, loadingMoreRecent, recentOffset]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="p-4 space-y-4">
            {/* Controls */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {WINDOW_OPTIONS.map((opt) => (
                        <button
                            key={opt.days}
                            onClick={() => setWindowDays(opt.days)}
                            className={`px-3 py-1.5 text-xs rounded-md border transition ${
                                windowDays === opt.days
                                    ? 'bg-green-50 border-green-500 text-green-700'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={load}
                    className="p-2 rounded hover:bg-gray-100 text-gray-500"
                    title="Refresh"
                >
                    <ArrowClockwise size={16} />
                </button>
            </div>

            {/* Stats */}
            <StatsCards overview={overview} loading={loadingOverview} />

            {/* Recent activity */}
            <RecentActivity
                items={recent}
                loading={loadingRecent}
                hasMore={hasMoreRecent}
                loadingMore={loadingMoreRecent}
                onLoadMore={loadMoreRecent}
            />
        </div>
    );
}
