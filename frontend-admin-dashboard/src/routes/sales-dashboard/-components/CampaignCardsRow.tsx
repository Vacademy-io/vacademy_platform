import { useQuery } from '@tanstack/react-query';
import { Megaphone } from '@phosphor-icons/react';
import { fetchCampaignCards } from '../-services/sales-dashboard-services';

interface Props {
    instituteId: string;
    period: 'DAY' | 'WEEK' | 'MONTH';
}

export function CampaignCardsRow({ instituteId, period }: Props) {
    const { data, isLoading } = useQuery({
        queryKey: ['sales-dashboard-campaign-cards', instituteId, period],
        enabled: !!instituteId,
        queryFn: () => fetchCampaignCards(instituteId, period),
    });

    return (
        <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3">
                <h3 className="text-h4 font-medium text-neutral-900">Campaigns this {period.toLowerCase()}</h3>
                <p className="text-caption text-neutral-500">Lead volume + conversions per campaign</p>
            </div>
            {isLoading ? (
                <div className="text-subtitle text-neutral-500">Loading…</div>
            ) : !data || data.length === 0 ? (
                <div className="text-subtitle text-neutral-500">No campaigns this window.</div>
            ) : (
                <div className="flex gap-3 overflow-x-auto">
                    {data.map((c) => (
                        <article
                            key={c.campaign_id}
                            className="w-64 shrink-0 rounded-md border border-neutral-200 bg-neutral-50 p-3"
                        >
                            <div className="mb-1 flex items-center gap-2 text-subtitle text-neutral-700">
                                <Megaphone size={14} />
                                <span className="truncate">{c.campaign_name}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-caption text-neutral-500">
                                <span>Leads</span>
                                <span>Conv.</span>
                                <span>Rate</span>
                                <span className="text-h4 font-medium text-primary-700">
                                    {c.leads_in_window}
                                </span>
                                <span className="text-h4 font-medium text-success-700">
                                    {c.conversions_in_window}
                                </span>
                                <span className="text-h4 font-medium text-neutral-700">
                                    {Number(c.conversion_rate).toFixed(0)}%
                                </span>
                            </div>
                            {c.top_counsellor_user_id && (
                                <div className="mt-2 truncate text-caption text-neutral-500">
                                    Top: {c.top_counsellor_name ?? c.top_counsellor_user_id.slice(0, 6)} ·{' '}
                                    {c.top_counsellor_conversions ?? 0} conv.
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
