import { useCounsellorRatingLeaderboard } from '@/components/counsellor/useCounsellorRating';
import { CounsellorRatingBadge } from '@/components/counsellor/CounsellorRatingBadge';

interface Props {
    instituteId: string;
    teamId: string | undefined;
}

export function CounsellorLeaderboardWidget({ instituteId, teamId }: Props) {
    const { data, isLoading } = useCounsellorRatingLeaderboard(instituteId, teamId, 10);

    return (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3">
                <h3 className="text-h4 font-medium text-neutral-900">Top counsellors</h3>
                <p className="text-caption text-neutral-500">Ranked by rating</p>
            </div>
            {isLoading ? (
                <div className="text-subtitle text-neutral-500">Loading…</div>
            ) : !data || data.length === 0 ? (
                <div className="text-subtitle text-neutral-500">No ratings computed yet.</div>
            ) : (
                <ol className="space-y-1.5">
                    {data.map((c) => (
                        <li
                            key={c.counsellor_user_id}
                            className="flex items-center gap-3 rounded-md border border-neutral-100 px-2 py-1.5"
                        >
                            <span className="w-6 text-center text-h4 font-medium text-neutral-500">
                                {c.rank}
                            </span>
                            <div className="min-w-0 flex-1 truncate text-body text-neutral-900">
                                {c.full_name ?? c.counsellor_user_id.slice(0, 8)}
                            </div>
                            <CounsellorRatingBadge
                                instituteId={instituteId}
                                userId={c.counsellor_user_id}
                                size="sm"
                            />
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
