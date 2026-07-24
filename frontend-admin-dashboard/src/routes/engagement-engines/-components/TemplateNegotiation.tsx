import { useState } from 'react';
import { ArrowsClockwise, Plus, Sparkle, Trash } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ToneBadge } from './ToneBadge';
import { PROPOSAL_STATUS_META, TEMPLATE_CATEGORY_OPTIONS } from '../-constants';
import { useTemplateMutation, useTemplates } from '../-hooks';
import { safeParse } from '../-utils';
import type {
    EngagementTemplateProposal,
    TemplateCategory,
    TemplateEditRequest,
} from '../-types';

const EDITABLE = new Set(['AI_PROPOSED', 'USER_REVIEW', 'META_REJECTED']);

export function TemplateNegotiation({ engineId }: { engineId: string }) {
    const { data: proposals, isLoading, isError } = useTemplates(engineId);
    const m = useTemplateMutation();
    const [editing, setEditing] = useState<EngagementTemplateProposal | null>(null);

    const anyProposals = (proposals?.length ?? 0) > 0;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-subtitle font-semibold text-neutral-700">WhatsApp templates</p>
                    <p className="text-caption text-neutral-500">
                        Proactive WhatsApp needs Meta-approved templates. The AI proposes them; you approve
                        and submit; Meta reviews.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        disable={m.sync.isPending}
                        onClick={() => m.sync.mutate({ engineId })}
                    >
                        <ArrowsClockwise className="mr-1 size-4" /> Check Meta
                    </MyButton>
                    {anyProposals ? (
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            disable={m.alternatives.isPending}
                            onClick={() => m.alternatives.mutate({ engineId })}
                        >
                            <Plus className="mr-1 size-4" /> More options
                        </MyButton>
                    ) : (
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            disable={m.recommend.isPending}
                            onClick={() => m.recommend.mutate({ engineId })}
                        >
                            <Sparkle className="mr-1 size-4" />
                            {m.recommend.isPending ? 'Thinking…' : 'Propose templates'}
                        </MyButton>
                    )}
                </div>
            </div>

            {isLoading && <Skeleton className="h-24 w-full rounded-lg" />}

            {!isLoading && isError && (
                <Card className="p-6 text-center text-body text-danger-600">
                    Could not load templates. Please retry.
                </Card>
            )}

            {!isLoading && !isError && !anyProposals && (
                <Card className="p-6 text-center text-body text-neutral-500">
                    No templates yet. Let the AI propose a few based on this engine&apos;s brief.
                </Card>
            )}

            <div className="flex flex-col gap-3">
                {proposals?.map((p) => (
                    <ProposalCard
                        key={p.id}
                        p={p}
                        engineId={engineId}
                        onEdit={() => setEditing(p)}
                        mutations={m}
                    />
                ))}
            </div>

            {editing && (
                <EditTemplateDialog
                    proposal={editing}
                    engineId={engineId}
                    onClose={() => setEditing(null)}
                    onSave={(payload) =>
                        m.edit.mutate(
                            { id: editing.id, engineId, payload },
                            { onSuccess: () => setEditing(null) }
                        )
                    }
                    saving={m.edit.isPending}
                />
            )}
        </div>
    );
}

function ProposalCard({
    p,
    engineId,
    onEdit,
    mutations,
}: {
    p: EngagementTemplateProposal;
    engineId: string;
    onEdit: () => void;
    mutations: ReturnType<typeof useTemplateMutation>;
}) {
    const meta = PROPOSAL_STATUS_META[p.status] ?? { label: p.status, tone: 'neutral' as const };
    const vars = safeParse<string[]>(p.variableNames, []);
    const busy =
        mutations.approve.isPending || mutations.submit.isPending || mutations.withdraw.isPending;

    return (
        <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-caption text-neutral-500">{p.name}</span>
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-caption text-neutral-500">
                            {p.proposedCategory}
                        </span>
                        <span className="text-caption text-neutral-400">round {p.round}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-body text-neutral-700">{p.proposedBody}</p>
                    {vars.length > 0 && (
                        <p className="mt-1 text-caption text-neutral-400">
                            Variables: {vars.join(', ')}
                        </p>
                    )}
                    {p.rationale && (
                        <p className="mt-1 text-caption italic text-neutral-400">{p.rationale}</p>
                    )}
                    {p.status === 'META_REJECTED' && p.rejectionReason && (
                        <p className="mt-2 rounded bg-danger-50 p-2 text-caption text-danger-600">
                            Meta: {p.rejectionReason}
                        </p>
                    )}
                    {p.status === 'META_RECATEGORISED' && (
                        <p className="mt-2 rounded bg-warning-50 p-2 text-caption text-warning-600">
                            Meta approved this but as <b>{p.metaCategory}</b> (you proposed{' '}
                            {p.proposedCategory}). It&apos;s usable; request alternatives if the category
                            matters.
                        </p>
                    )}
                </div>
                <ToneBadge label={meta.label} tone={meta.tone} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                {EDITABLE.has(p.status) && (
                    <MyButton buttonType="secondary" scale="small" disable={busy} onClick={onEdit}>
                        Edit
                    </MyButton>
                )}
                {(p.status === 'AI_PROPOSED' || p.status === 'USER_REVIEW') && (
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        disable={busy}
                        onClick={() => mutations.approve.mutate({ id: p.id, engineId })}
                    >
                        Approve
                    </MyButton>
                )}
                {p.status === 'USER_APPROVED' && (
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        disable={busy}
                        onClick={() => mutations.submit.mutate({ id: p.id, engineId })}
                    >
                        Submit to Meta
                    </MyButton>
                )}
                {['AI_PROPOSED', 'USER_REVIEW', 'USER_APPROVED', 'META_REJECTED', 'META_RECATEGORISED'].includes(
                    p.status
                ) && (
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        disable={busy}
                        onClick={() => mutations.withdraw.mutate({ id: p.id, engineId })}
                    >
                        <Trash className="mr-1 size-3.5" /> Withdraw
                    </MyButton>
                )}
            </div>
        </Card>
    );
}

function EditTemplateDialog({
    proposal,
    onClose,
    onSave,
    saving,
}: {
    proposal: EngagementTemplateProposal;
    engineId: string;
    onClose: () => void;
    onSave: (payload: TemplateEditRequest) => void;
    saving: boolean;
}) {
    const [body, setBody] = useState(proposal.proposedBody);
    const [category, setCategory] = useState<TemplateCategory>(proposal.proposedCategory);
    const [pairs, setPairs] = useState<{ name: string; sample: string }[]>(() => {
        const names = safeParse<string[]>(proposal.variableNames, []);
        const samples = safeParse<string[]>(proposal.sampleValues, []);
        return names.map((n, i) => ({ name: n, sample: samples[i] ?? '' }));
    });
    const [footer, setFooter] = useState(proposal.footerText ?? '');

    // Mirror the backend's alignmentProblem() EXACTLY so the FE never enables Save for a body the
    // server will reject, nor blocks a valid one: distinct indices, no {{0}}, contiguous 1..k, and
    // exactly k variable rows (k = max index; a repeated {{1}} counts once). Plus the 1024 body cap.
    const problem = ((): string | null => {
        if (!body.trim()) return 'The body is empty.';
        if (body.length > 1024) return 'The body exceeds WhatsApp’s 1024-character limit.';
        const nums = Array.from(body.matchAll(/\{\{(\d+)\}\}/g)).map((mm) => Number(mm[1]));
        const distinct = Array.from(new Set(nums)).sort((a, b) => a - b);
        if (distinct.length && distinct[0]! < 1) return 'Placeholders start at {{1}} — {{0}} is not allowed.';
        const k = distinct.length ? distinct[distinct.length - 1]! : 0;
        for (let i = 1; i <= k; i++) {
            if (!distinct.includes(i)) return `Placeholder {{${i}}} is missing — they must be sequential from 1.`;
        }
        if (pairs.length !== k) return `The body has ${k} variable(s) but ${pairs.length} row(s). They must match.`;
        return null;
    })();
    const misaligned = problem !== null;

    const save = () =>
        onSave({
            body,
            category,
            variableNames: pairs.map((p) => p.name.trim()),
            sampleValues: pairs.map((p) => p.sample.trim()),
            footerText: footer.trim() || undefined,
        });

    return (
        <MyDialog heading="Edit template" open onOpenChange={(o) => !o && onClose()} dialogWidth="max-w-xl">
            <div className="flex flex-col gap-4 overflow-y-auto p-1">
                <div>
                    <label className="mb-1 block text-caption text-neutral-500">
                        Body (use {'{{1}}'}, {'{{2}}'} … for variables)
                    </label>
                    <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
                </div>
                <div className="w-48">
                    <label className="mb-1 block text-caption text-neutral-500">Category</label>
                    <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TEMPLATE_CATEGORY_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-caption text-neutral-500">
                        Variables (one per {'{{n}}'}, in order) + a sample value Meta shows a reviewer
                    </label>
                    {pairs.map((pair, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="w-8 font-mono text-caption text-neutral-400">
                                {`{{${i + 1}}}`}
                            </span>
                            <Input
                                value={pair.name}
                                placeholder="name"
                                onChange={(e) =>
                                    setPairs((prev) =>
                                        prev.map((p, idx) => (idx === i ? { ...p, name: e.target.value } : p))
                                    )
                                }
                            />
                            <Input
                                value={pair.sample}
                                placeholder="e.g. Aisha"
                                onChange={(e) =>
                                    setPairs((prev) =>
                                        prev.map((p, idx) =>
                                            idx === i ? { ...p, sample: e.target.value } : p
                                        )
                                    )
                                }
                            />
                            <button
                                type="button"
                                className="text-neutral-400 hover:text-danger-600"
                                onClick={() => setPairs((prev) => prev.filter((_, idx) => idx !== i))}
                            >
                                <Trash className="size-4" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        className="w-fit text-caption text-primary-600"
                        onClick={() => setPairs((prev) => [...prev, { name: '', sample: '' }])}
                    >
                        + Add variable
                    </button>
                    {problem && <p className="text-caption text-danger-600">{problem}</p>}
                </div>
                <div>
                    <label className="mb-1 block text-caption text-neutral-500">
                        Footer (optional, ≤60 chars)
                    </label>
                    <Input
                        value={footer}
                        maxLength={60}
                        onChange={(e) => setFooter(e.target.value)}
                    />
                </div>
                <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
                    <MyButton buttonType="secondary" scale="small" onClick={onClose}>
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        disable={saving || misaligned || !body.trim()}
                        onClick={save}
                    >
                        {saving ? 'Saving…' : 'Save changes'}
                    </MyButton>
                </div>
            </div>
        </MyDialog>
    );
}
