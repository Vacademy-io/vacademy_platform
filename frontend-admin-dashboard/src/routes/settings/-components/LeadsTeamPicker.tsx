import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { MyButton } from '@/components/design-system/button';
import { getInstituteId } from '@/constants/helper';
import { COUNSELLOR_RATING_MANUAL } from '@/constants/urls';
import {
    fetchTeamCounsellors,
    fetchWorkbenchConfig,
    updateWorkbenchConfig,
    type WorkbenchCounsellor,
} from '@/routes/counsellors/-services/counsellor-workbench-services';
import { listTeams } from '@/routes/manage-institute/teams/-services/org-team-services';
import { User } from '@phosphor-icons/react';

/**
 * Pick the leads team and tune the per-counsellor static rating in one
 * panel. The team picker writes LEAD_SETTING.workbench.leads_team_id; the
 * member list below resolves users in that team and exposes a manual rating
 * override input per row (used when the strategy is STATIC, kept around as
 * a remembered value when on STRATEGY_BASED).
 */
export function LeadsTeamPicker() {
    const instituteId = getInstituteId();
    const [pendingTeamId, setPendingTeamId] = useState<string | ''>('');
    const [saving, setSaving] = useState(false);

    const configQuery = useQuery({
        queryKey: ['workbench-config', instituteId],
        enabled: !!instituteId,
        queryFn: () => fetchWorkbenchConfig(instituteId!),
    });

    const teamsQuery = useQuery({
        queryKey: ['org-teams', instituteId],
        enabled: !!instituteId,
        queryFn: () => listTeams(instituteId!),
    });

    useEffect(() => {
        if (configQuery.data?.leads_team_id) {
            setPendingTeamId(configQuery.data.leads_team_id);
        }
    }, [configQuery.data?.leads_team_id]);

    async function handleSave() {
        if (!instituteId) return;
        setSaving(true);
        try {
            await updateWorkbenchConfig({
                institute_id: instituteId,
                leads_team_id: pendingTeamId === '' ? null : pendingTeamId,
            });
            toast.success('Leads team updated');
            configQuery.refetch();
        } catch (e) {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Could not save');
        } finally {
            setSaving(false);
        }
    }

    const teams = teamsQuery.data ?? [];
    const isLoading = teamsQuery.isLoading || configQuery.isLoading;
    // Resolved team is the saved one (not the in-edit pending value) — we
    // want the members list to reflect what's actually live.
    const savedTeamId = configQuery.data?.leads_team_id ?? null;

    return (
        <section className="space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="mb-3">
                    <h3 className="text-h4 font-medium text-neutral-900">
                        Counsellor Workbench team
                    </h3>
                    <p className="text-caption text-neutral-500">
                        Pick the team whose members count as your sales / counselling
                        people. They’ll see lead lists scoped to themselves and the
                        people reporting up to them.
                    </p>
                </div>
                {isLoading ? (
                    <div className="text-subtitle text-neutral-500">Loading…</div>
                ) : teams.length === 0 ? (
                    <div className="text-subtitle text-neutral-500">
                        No teams yet. Create one in Manage Institute → Teams → Org Chart.
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            className="min-w-64 rounded border border-neutral-300 px-3 py-2"
                            value={pendingTeamId}
                            onChange={(e) => setPendingTeamId(e.target.value)}
                        >
                            <option value="">— Not set —</option>
                            {teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name} ({t.member_count})
                                </option>
                            ))}
                        </select>
                        <MyButton
                            buttonType="primary"
                            onClick={handleSave}
                            disable={
                                saving || pendingTeamId === (configQuery.data?.leads_team_id ?? '')
                            }
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </MyButton>
                    </div>
                )}
            </div>

            {savedTeamId && instituteId && (
                <TeamMembersList instituteId={instituteId} teamId={savedTeamId} />
            )}
        </section>
    );
}

/**
 * Lists every counsellor in the saved leads team with their resolved name,
 * current rating, and an inline editor for the static rating override.
 *
 * Editing inline mirrors how spreadsheets work — type a number, blur (or
 * press Enter) to save, undo via the X icon if you change your mind before
 * blurring.
 */
function TeamMembersList({ instituteId, teamId }: { instituteId: string; teamId: string }) {
    const counsellorsQuery = useQuery({
        queryKey: ['workbench-counsellors-team-picker', instituteId, teamId],
        enabled: !!instituteId && !!teamId,
        // Settings view wants the WHOLE roster (no per-page pagination).
        // The workbench list endpoint now paginates by default; size=500
        // covers any team we currently support.
        queryFn: () => fetchTeamCounsellors(instituteId, teamId, { size: 500 }),
    });

    const counsellors = counsellorsQuery.data?.content ?? [];

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-h4 font-medium text-neutral-900">
                        Counsellors in this team
                    </h3>
                    <p className="text-caption text-neutral-500">
                        Set a static rating (0–100) per person. Used when the rating
                        strategy below is set to <span className="font-medium">Static</span>.
                        Kept as a remembered fallback when on Strategy-based.
                    </p>
                </div>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-medium text-neutral-700">
                    {counsellors.length} {counsellors.length === 1 ? 'person' : 'people'}
                </span>
            </div>

            {counsellorsQuery.isLoading ? (
                <div className="text-subtitle text-neutral-500">Loading team members…</div>
            ) : counsellorsQuery.isError ? (
                <div className="text-subtitle text-danger-600">
                    Could not load team members.
                </div>
            ) : counsellors.length === 0 ? (
                <div className="text-subtitle text-neutral-500">
                    No one is in this team yet. Add people to it in Manage Institute →
                    Teams → Org Chart.
                </div>
            ) : (
                <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200">
                    {counsellors.map((c) => (
                        <MemberRow key={c.user_id} instituteId={instituteId} counsellor={c} />
                    ))}
                </ul>
            )}
        </div>
    );
}

function MemberRow({
    instituteId,
    counsellor,
}: {
    instituteId: string;
    counsellor: WorkbenchCounsellor;
}) {
    const queryClient = useQueryClient();
    const initialScore = counsellor.rating != null ? String(counsellor.rating) : '';
    const [draftScore, setDraftScore] = useState(initialScore);

    useEffect(() => {
        setDraftScore(counsellor.rating != null ? String(counsellor.rating) : '');
    }, [counsellor.rating]);

    const saveMutation = useMutation({
        mutationFn: async (score: number) => {
            await authenticatedAxiosInstance.put(COUNSELLOR_RATING_MANUAL(counsellor.user_id), {
                institute_id: instituteId,
                score,
            });
        },
        onSuccess: () => {
            toast.success(`Saved ${counsellor.full_name ?? 'rating'}`);
            queryClient.invalidateQueries({
                queryKey: ['workbench-counsellors', instituteId],
            });
            queryClient.invalidateQueries({
                queryKey: ['counsellor-rating', instituteId, counsellor.user_id],
            });
        },
        onError: (e) => {
            const msg = (e as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Could not save rating');
        },
    });

    function commit() {
        const trimmed = draftScore.trim();
        if (trimmed === '' || trimmed === initialScore) return;
        const n = parseFloat(trimmed);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
            toast.error('Rating must be a number between 0 and 100');
            setDraftScore(initialScore);
            return;
        }
        saveMutation.mutate(n);
    }

    const score = counsellor.rating;
    const scoreColor =
        score == null
            ? 'bg-neutral-100 text-neutral-500'
            : score >= 75
            ? 'bg-success-50 text-success-700'
            : score >= 50
            ? 'bg-warning-50 text-warning-700'
            : 'bg-danger-50 text-danger-700';

    return (
        <li className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={counsellor.full_name ?? ''} />
            <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-body font-medium text-neutral-900">
                    {counsellor.full_name || 'Unnamed'}
                </div>
                <div className="truncate text-caption text-neutral-500">
                    {counsellor.email ?? counsellor.role_label ?? ''}
                </div>
            </div>
            <div
                className={`rounded-full px-2 py-0.5 text-caption font-semibold ${scoreColor}`}
                title="Current effective rating"
            >
                {score != null ? score.toFixed(0) : '—'}
            </div>
            <div className="flex items-center gap-2">
                <label className="text-caption text-neutral-500">Static</label>
                <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="w-20 rounded border border-neutral-300 px-2 py-1.5 text-body"
                    value={draftScore}
                    placeholder="0–100"
                    onChange={(e) => setDraftScore(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setDraftScore(initialScore);
                    }}
                    disabled={saveMutation.isPending}
                />
                {saveMutation.isPending && (
                    <span className="text-caption text-neutral-500">Saving…</span>
                )}
            </div>
        </li>
    );
}

function Avatar({ name }: { name: string }) {
    const initial = (name || '?').trim().slice(0, 1).toUpperCase();
    return (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-h4 font-semibold text-primary-700">
            {initial || <User size={16} />}
        </div>
    );
}
