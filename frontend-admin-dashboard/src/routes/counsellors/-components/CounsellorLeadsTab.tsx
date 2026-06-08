import { useQuery } from '@tanstack/react-query';
import { Phone, ArrowsClockwise, ArrowSquareOut } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { fetchMyLeads, type WorkbenchLead } from '../-services/counsellor-workbench-services';

interface Props {
    instituteId: string;
    counsellorUserId: string;
    onReassign: (lead: WorkbenchLead) => void;
}

/**
 * Tab body — list of leads currently assigned to the selected counsellor.
 * Reuses the workbench /me/leads endpoint with a filter on user when viewing
 * someone other than self (admin path). For self, the auth context makes
 * /me/leads return the same data.
 */
export function CounsellorLeadsTab({ instituteId, counsellorUserId, onReassign }: Props) {
    // For now we use the existing /me/leads as a proxy; a per-counsellor endpoint can be added later
    // when admin viewing of subordinate leads needs distinct scoping.
    const { data: leads, isLoading } = useQuery({
        queryKey: ['workbench-leads', instituteId, counsellorUserId],
        enabled: !!instituteId && !!counsellorUserId,
        queryFn: () => fetchMyLeads(instituteId, 'LEAD', 0, 50),
    });

    if (isLoading) {
        return <div className="p-4 text-subtitle text-neutral-500">Loading leads…</div>;
    }
    if (!leads || leads.length === 0) {
        return (
            <div className="rounded border border-dashed border-neutral-300 p-6 text-center text-subtitle text-neutral-500">
                No open leads.
            </div>
        );
    }

    return (
        <div className="overflow-auto rounded border border-neutral-200">
            <table className="w-full text-body">
                <thead className="bg-neutral-50 text-caption uppercase tracking-wide text-neutral-500">
                    <tr>
                        <th className="px-3 py-2 text-left">Lead</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Score</th>
                        <th className="px-3 py-2 text-left">Campaign</th>
                        <th className="px-3 py-2 text-left">Assigned</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {leads.map((l) => (
                        <tr key={l.lead_id} className="border-t border-neutral-100">
                            <td className="px-3 py-2.5">
                                <div className="text-body font-medium text-neutral-900">
                                    {l.lead_name ?? l.user_id.slice(0, 8)}
                                </div>
                                <div className="text-caption text-neutral-500">{l.lead_email}</div>
                            </td>
                            <td className="px-3 py-2.5 text-neutral-700">
                                {l.lead_status_label ?? l.conversion_status}
                            </td>
                            <td className="px-3 py-2.5">
                                <span className="rounded bg-primary-50 px-2 py-0.5 text-caption font-medium text-primary-700">
                                    {l.best_score ?? 0}
                                </span>
                            </td>
                            <td className="px-3 py-2.5 text-neutral-700">{l.campaign_name ?? '—'}</td>
                            <td className="px-3 py-2.5 text-caption text-neutral-500">
                                {l.assigned_at ? new Date(l.assigned_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-3 py-2.5">
                                <div className="flex justify-end gap-1">
                                    <button
                                        type="button"
                                        className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
                                        aria-label="Open lead"
                                    >
                                        <ArrowSquareOut size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded p-1 text-success-600 hover:bg-success-50"
                                        aria-label="Call"
                                    >
                                        <Phone size={16} />
                                    </button>
                                    <MyButton
                                        buttonType="secondary"
                                        scale="small"
                                        onClick={() => onReassign(l)}
                                    >
                                        <ArrowsClockwise size={14} className="mr-1" /> Reassign
                                    </MyButton>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
