import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Sparkle,
    Check,
    PaperPlaneRight,
    Robot,
    User as UserIcon,
    CircleNotch,
    SidebarSimple,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type {
    AssistTurn,
    DecisionAnswer,
    DecisionRequest,
} from '../../-services/video-generation';
import { GATE_META, gateTitle } from './-utils/decision-copy';
import { NarrationDecision } from './gates/NarrationDecision';
import { ShotPlanDecision } from './gates/ShotPlanDecision';
import { VisualCastingDecision } from './gates/VisualCastingDecision';

interface AssistChatProps {
    /** The original prompt — rendered as the opening user message. */
    prompt: string;
    /** The decision currently awaiting the user, or null between gates. */
    pending: DecisionRequest | null;
    /** Resolved turns, oldest → newest. */
    transcript: AssistTurn[];
    /** True while the next leg is opening (disables cards). */
    isSubmitting?: boolean;
    /** Latest status line ("Planning your shots…") shown as an agent bubble. */
    statusMessage?: string;
    onSubmit: (answer: DecisionAnswer) => void;
    /** Opens the production-diagram drawer. */
    onShowProgress?: () => void;
    vimMode?: boolean;
}

function Bubble({ side, children }: { side: 'agent' | 'user'; children: ReactNode }) {
    const isAgent = side === 'agent';
    return (
        <div className={cn('flex gap-2.5', isAgent ? 'justify-start' : 'justify-end')}>
            {isAgent && (
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                    <Robot className="size-4 text-violet-600" />
                </span>
            )}
            <div
                className={cn(
                    'max-w-md rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                    isAgent
                        ? 'rounded-tl-sm bg-muted text-foreground'
                        : 'rounded-tr-sm bg-violet-600 text-white'
                )}
            >
                {children}
            </div>
            {!isAgent && (
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600/10">
                    <UserIcon className="size-4 text-violet-600" />
                </span>
            )}
        </div>
    );
}

/** Generic card for gates without a bespoke editor (creative_concept, future). */
function GenericDecision({
    decision,
    isSubmitting,
    onSubmit,
}: {
    decision: DecisionRequest;
    isSubmitting?: boolean;
    onSubmit: (answer: DecisionAnswer) => void;
}) {
    const concept = decision.payload?.concept as Record<string, unknown> | undefined;
    return (
        <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-card">
            {concept && (
                <dl className="mb-3 space-y-1.5 text-xs">
                    {Object.entries(concept).map(([k, v]) =>
                        v ? (
                            <div key={k} className="flex gap-2">
                                <dt className="shrink-0 font-medium capitalize text-muted-foreground">
                                    {k.replace(/_/g, ' ')}:
                                </dt>
                                <dd className="text-foreground">{String(v)}</dd>
                            </div>
                        ) : null
                    )}
                </dl>
            )}
            {decision.options.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                    {decision.options.map((o) => (
                        <Button
                            key={o.option_id}
                            variant="outline"
                            size="sm"
                            disabled={isSubmitting}
                            onClick={() => onSubmit({ kind: 'choose_option', option_id: o.option_id })}
                        >
                            {o.label}
                            {o.is_recommended && <span className="ml-1 text-xs text-violet-600">★</span>}
                        </Button>
                    ))}
                </div>
            )}
            <div className="flex items-center justify-between gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => onSubmit({ kind: 'auto' })}
                    className="gap-1.5 text-muted-foreground"
                >
                    <Sparkle className="size-3.5" />
                    Let AI decide
                </Button>
                <Button
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => onSubmit({ kind: 'accept_recommended' })}
                    className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
                >
                    <Check className="size-4" />
                    Approve
                </Button>
            </div>
        </div>
    );
}

function DecisionCard({
    decision,
    prompt,
    isSubmitting,
    onSubmit,
}: {
    decision: DecisionRequest;
    prompt: string;
    isSubmitting?: boolean;
    onSubmit: (answer: DecisionAnswer) => void;
}) {
    switch (decision.gate_type) {
        case 'narration':
            return (
                <NarrationDecision
                    decision={decision}
                    prompt={prompt}
                    isSubmitting={isSubmitting}
                    onSubmit={onSubmit}
                />
            );
        case 'shot_plan':
            return <ShotPlanDecision decision={decision} isSubmitting={isSubmitting} onSubmit={onSubmit} />;
        case 'visual_casting':
            return (
                <VisualCastingDecision decision={decision} isSubmitting={isSubmitting} onSubmit={onSubmit} />
            );
        default:
            return <GenericDecision decision={decision} isSubmitting={isSubmitting} onSubmit={onSubmit} />;
    }
}

/**
 * Chat-first assist surface — the primary view while the pipeline pauses for
 * the user. Renders the conversation transcript + the current decision card,
 * with a free-form steering input. The production diagram lives behind the
 * "Show progress" button (a secondary drawer).
 */
export function AssistChat({
    prompt,
    pending,
    transcript,
    isSubmitting,
    statusMessage,
    onSubmit,
    onShowProgress,
}: AssistChatProps) {
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const [steer, setSteer] = useState('');

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [pending?.decision_id, transcript.length, isSubmitting]);

    const sendSteer = () => {
        const text = steer.trim();
        if (!text || !pending) return;
        setSteer('');
        onSubmit({ kind: 'freeform', text });
    };

    return (
        <div className="mx-auto flex size-full max-w-3xl flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
                        <Sparkle className="size-4 text-violet-600" />
                    </span>
                    <div className="text-sm font-semibold text-foreground">Assist</div>
                </div>
                {onShowProgress && (
                    <Button variant="outline" size="sm" onClick={onShowProgress} className="gap-1.5">
                        <SidebarSimple className="size-3.5" />
                        Show progress
                    </Button>
                )}
            </div>

            {/* Conversation */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <Bubble side="user">{prompt}</Bubble>

                {transcript.map((t) => (
                    <div key={t.decision_id} className="space-y-2">
                        <Bubble side="agent">{t.prompt}</Bubble>
                        <Bubble side="user">{t.answer_summary}</Bubble>
                    </div>
                ))}

                {pending ? (
                    <div className="space-y-3">
                        <Bubble side="agent">
                            <div className="font-medium">{gateTitle(pending.gate_type)}</div>
                            <div className="mt-0.5 text-muted-foreground">{pending.prompt}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground/70">
                                {GATE_META[pending.gate_type]?.blurb}
                            </div>
                        </Bubble>
                        <DecisionCard
                            decision={pending}
                            prompt={prompt}
                            isSubmitting={isSubmitting}
                            onSubmit={onSubmit}
                        />
                    </div>
                ) : (
                    <Bubble side="agent">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <CircleNotch className="size-4 animate-spin" />
                            {statusMessage || 'Working on it…'}
                        </span>
                    </Bubble>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Free-form steering input — enabled only while a decision is pending */}
            <div className="border-t px-4 py-3">
                <div className="flex items-center gap-2">
                    <Input
                        value={steer}
                        disabled={!pending || isSubmitting}
                        onChange={(e) => setSteer(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendSteer();
                            }
                        }}
                        placeholder={
                            pending
                                ? 'Steer it — e.g. “make shot 3 funnier and shorter”'
                                : 'Working…'
                        }
                        className="h-9"
                    />
                    <Button
                        size="sm"
                        disabled={!pending || isSubmitting || !steer.trim()}
                        onClick={sendSteer}
                        className="gap-1.5"
                    >
                        <PaperPlaneRight className="size-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
