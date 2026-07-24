/**
 * AI Copilot (Phase B) — conversational editing of the current page.
 * The admin types an instruction; ai_service returns a small list of ops;
 * we apply them to a SHADOW copy and show a plain-language diff card with
 * Apply / Discard. Apply commits via updateConfig (undo-able); nothing
 * touches the page until then.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Sparkle, CircleNotch, PaperPlaneRight, Plus, PencilSimple,
    Trash, ArrowsDownUp, Palette, Check, X, Target,
} from '@phosphor-icons/react';
import { useToast } from '@/hooks/use-toast';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useEditorStore } from '../-stores/editor-store';
import {
    editAiPage, applyOps, deriveBrandKit, brandKitToGlobalPatch,
    EditOp, EditChatTurn, BrandKit,
} from '../-services/ai-page-service';
import { CatalogueConfig } from '../-types/editor-types';

/** Representative primary swatch per theme preset (for the kit card dot).
 *  These are preview-only representations of each preset's hue, not UI chrome. */
const PRESET_SWATCH: Record<string, string> = {
    default: '#EA7A1E', ocean: '#0EA5E9', forest: '#22C55E', sunset: '#F97316', // design-lint-ignore: theme-preset preview swatches
    midnight: '#7C3AED', rose: '#E11D6F', violet: '#8B5CF6', amber: '#F59E0B', slate: '#334155', // design-lint-ignore: theme-preset preview swatches
};

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface PendingEdit {
    ops: EditOp[];
    shadow: CatalogueConfig;
    warnings: string[];
}

const OP_ICON: Record<EditOp['op'], React.ComponentType<any>> = {
    insert: Plus,
    update: PencilSimple,
    remove: Trash,
    move: ArrowsDownUp,
    updateGlobalSettings: Palette,
};

const opLabel = (op: EditOp): string => {
    if (op.note) return op.note;
    switch (op.op) {
        case 'insert': return `Add a ${op.component.type} section`;
        case 'update': return `Update ${op.id}`;
        case 'remove': return `Remove ${op.id}`;
        case 'move': return `Reorder ${op.id}`;
        case 'updateGlobalSettings': return 'Update site theme';
    }
};

export const AiCopilotPanel = () => {
    const { config, selectedPageId, selectedComponentId, updateConfig } = useEditorStore();
    const { instituteDetails } = useInstituteDetailsStore();
    const { toast } = useToast();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [pending, setPending] = useState<PendingEdit | null>(null);
    const [brandKits, setBrandKits] = useState<BrandKit[] | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const terminology = useMemo(
        () => ({
            course: getTerminology(ContentTerms.Course, SystemTerms.Course),
            level: getTerminology(ContentTerms.Level, SystemTerms.Level),
            batch: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
            learner: getTerminology(RoleTerms.Learner, SystemTerms.Learner),
        }),
        []
    );

    const selectedComponent = useMemo(() => {
        if (!selectedComponentId || !config) return null;
        const page = config.pages.find((p) => p.id === selectedPageId);
        return page?.components.find((c) => c.id === selectedComponentId) || null;
    }, [config, selectedPageId, selectedComponentId]);

    const scrollToEnd = () => {
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    };

    const editMutation = useMutation({
        mutationFn: (instruction: string) => {
            const page = config!.pages.find((p) => p.id === selectedPageId)!;
            const history: EditChatTurn[] = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
            return editAiPage({
                page: { id: page.id, components: page.components },
                instruction,
                selected_component_id: selectedComponentId || undefined,
                institute_name: (instituteDetails as any)?.institute_name || undefined,
                terminology,
                history,
            });
        },
        onSuccess: (res) => {
            setMessages((m) => [...m, { role: 'assistant', content: res.reply || 'Done.' }]);
            if (res.ops.length && config && selectedPageId) {
                setPending({ ops: res.ops, shadow: applyOps(config, selectedPageId, res.ops), warnings: res.warnings });
            } else {
                setPending(null);
            }
            scrollToEnd();
        },
        onError: (err: any) => {
            const detail = err?.response?.data?.detail;
            setMessages((m) => [...m, { role: 'assistant', content: typeof detail === 'string' ? detail : 'Something went wrong — please try again.' }]);
            scrollToEnd();
        },
    });

    const send = () => {
        const text = input.trim();
        if (!text || !config || !selectedPageId || editMutation.isPending) return;
        setMessages((m) => [...m, { role: 'user', content: text }]);
        setInput('');
        setPending(null);
        setBrandKits(null);
        editMutation.mutate(text);
        scrollToEnd();
    };

    const brandMutation = useMutation({
        mutationFn: () =>
            deriveBrandKit({
                institute_name: (instituteDetails as any)?.institute_name || undefined,
                brief: `Catalogue website for ${(instituteDetails as any)?.institute_name || 'an institute'}`,
            }),
        onSuccess: (res) => {
            setBrandKits(res.kits);
            setMessages((m) => [...m, { role: 'assistant', content: 'Here are a few theme directions — pick one to preview it.' }]);
            scrollToEnd();
        },
        onError: (err: any) => {
            const detail = err?.response?.data?.detail;
            setMessages((m) => [...m, { role: 'assistant', content: typeof detail === 'string' ? detail : 'Could not fetch theme ideas.' }]);
            scrollToEnd();
        },
    });

    const pickKit = (kit: BrandKit) => {
        if (!config || !selectedPageId) return;
        const op: EditOp = { op: 'updateGlobalSettings', patch: brandKitToGlobalPatch(kit), note: `Apply theme: ${kit.label}` };
        setPending({ ops: [op], shadow: applyOps(config, selectedPageId, [op]), warnings: [] });
        setBrandKits(null);
        scrollToEnd();
    };

    const applyPending = () => {
        if (!pending) return;
        updateConfig(pending.shadow);
        setMessages((m) => [...m, { role: 'assistant', content: '✓ Applied to your page.' }]);
        setPending(null);
        scrollToEnd();
    };

    if (!config || !selectedPageId) {
        return <div className="p-4 text-sm text-gray-400">Select a page to start editing with AI.</div>;
    }

    return (
        <div className="flex h-full flex-col">
            {/* Thread */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
                {messages.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-500">
                        <p className="mb-1 flex items-center gap-1 font-medium text-gray-700">
                            <Sparkle className="size-3.5 text-primary-500" weight="duotone" /> Ask AI to edit this page
                        </p>
                        <p>Try: “make the hero darker”, “add a testimonials section after the courses”, “rewrite the FAQ answers to be friendlier”.</p>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                        <span
                            className={`inline-block max-w-64 rounded-lg px-3 py-2 text-xs ${
                                m.role === 'user' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                            {m.content}
                        </span>
                    </div>
                ))}
                {(editMutation.isPending || brandMutation.isPending) && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <CircleNotch className="size-4 animate-spin" /> Thinking…
                    </div>
                )}

                {/* Brand kit cards */}
                {brandKits && (
                    <div className="space-y-2">
                        {brandKits.map((kit, i) => (
                            <button
                                key={i}
                                onClick={() => pickKit(kit)}
                                className="flex w-full items-start gap-2.5 rounded-lg border border-gray-200 bg-white p-2.5 text-left transition-colors hover:border-primary-300 hover:bg-primary-50"
                            >
                                <span
                                    className="mt-0.5 size-6 shrink-0 rounded-full border border-black/5"
                                    style={{ backgroundColor: PRESET_SWATCH[kit.themePreset] || '#999' /* design-lint-ignore: preset swatch preview */ }}
                                />
                                <span className="min-w-0">
                                    <span className="block text-xs font-semibold text-gray-800">{kit.label}</span>
                                    <span className="block text-caption text-gray-500">
                                        {kit.fontFamily} · {kit.atmosphere.canvas}
                                    </span>
                                    <span className="mt-0.5 block text-caption text-gray-400">{kit.rationale}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Diff card */}
                {pending && (
                    <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
                        <p className="mb-2 text-xs font-semibold text-primary-600">Proposed changes</p>
                        <ul className="space-y-1.5">
                            {pending.ops.map((op, i) => {
                                const Icon = OP_ICON[op.op];
                                return (
                                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                                        <Icon className="mt-0.5 size-3.5 shrink-0 text-primary-500" />
                                        <span>{opLabel(op)}</span>
                                    </li>
                                );
                            })}
                        </ul>
                        {pending.warnings.length > 0 && (
                            <p className="mt-2 text-caption text-warning-600">
                                {pending.warnings.length} item(s) were auto-cleaned.
                            </p>
                        )}
                        <div className="mt-3 flex gap-2">
                            <Button size="sm" onClick={applyPending} className="h-7">
                                <Check className="mr-1 size-3.5" /> Apply
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setPending(null)} className="h-7">
                                <X className="mr-1 size-3.5" /> Discard
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t p-3">
                <div className="mb-2 flex items-center justify-between">
                    {selectedComponent ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-caption text-gray-600">
                            <Target className="size-3" /> editing: {selectedComponent.type}
                        </div>
                    ) : <span />}
                    <button
                        onClick={() => brandMutation.mutate()}
                        disabled={brandMutation.isPending}
                        className="inline-flex items-center gap-1 text-caption font-medium text-primary-500 hover:text-primary-400 disabled:opacity-50"
                    >
                        <Palette className="size-3" /> Theme ideas
                    </button>
                </div>
                <div className="flex items-end gap-2">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                send();
                            }
                        }}
                        rows={2}
                        placeholder="Describe a change…"
                        className="resize-none text-xs"
                    />
                    <Button size="sm" onClick={send} disabled={!input.trim() || editMutation.isPending} className="h-9 shrink-0 px-3">
                        <PaperPlaneRight className="size-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
