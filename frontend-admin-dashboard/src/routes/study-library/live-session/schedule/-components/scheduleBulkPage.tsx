import { BulkScheduleGrid } from './BulkScheduleGrid';

/**
 * Standalone Bulk Schedule page. Lives at
 * `/study-library/live-session/schedule/bulk` so admins have a clear,
 * separately-bookmarkable URL distinct from the single-class flow at
 * `/schedule/step1`.
 */
export default function ScheduleBulkPage() {
    return (
        <div className="flex flex-col gap-5">
            <div className="sticky top-0 z-[9] -mx-4 border-b border-neutral-200 bg-white px-4 py-3 sm:-mx-0 sm:px-0">
                <h1 className="text-lg font-semibold text-neutral-800">Bulk Schedule</h1>
                <p className="text-xs text-neutral-500">
                    Add many independent classes at once. Each row creates one session.
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                    Note: recurring classes can&apos;t be created here — use the single-class flow
                    for recurring schedules.
                </p>
            </div>
            <BulkScheduleGrid />
        </div>
    );
}
