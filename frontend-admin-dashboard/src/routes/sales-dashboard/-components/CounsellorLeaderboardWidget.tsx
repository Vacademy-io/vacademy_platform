import { useNavigate } from '@tanstack/react-router';
import { CaretRight } from '@phosphor-icons/react';
import { useCounsellorRatingLeaderboard } from '@/components/counsellor/useCounsellorRating';
import { CounsellorRatingBadge } from '@/components/counsellor/CounsellorRatingBadge';

interface Props {
    instituteId: string;
    teamId: string | undefined;
}

export function CounsellorLeaderboardWidget({ instituteId, teamId }: Props) {
    const navigate = useNavigate();
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
                        <li key={c.counsellor_user_id}>
                            {/* Drill-through → Recent Leads filtered to this counsellor. */}
                            <button
                                type="button"
                                onClick={() =>
                                    navigate({
                                        to: '/audience-manager/recent-leads',
                                        search: { counsellor: c.counsellor_user_id },
                                    })
                                }
                                className="group flex w-full cursor-pointer items-center gap-3 rounded-md border border-neutral-100 px-2 py-1.5 text-left hover:bg-neutral-50"
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
                                <CaretRight
                                    size={12}
                                    className="shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-500"
                                />
                            </button>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
