import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CaretDown, CaretRight, Check, Lock, Palette, Sparkle } from '@phosphor-icons/react';
import type {
    DecisionAnswer,
    DecisionRequest,
    DesignIdentity,
    DesignIdentityEdit,
} from '../../../-services/video-generation';

interface StyleframeDecisionProps {
    decision: DecisionRequest;
    isSubmitting?: boolean;
    onSubmit: (answer: DecisionAnswer) => void;
}

const GRAIN_OPTIONS = ['none', 'soft', 'film'] as const;
const VIGNETTE_OPTIONS = ['none', 'soft', 'medium'] as const;
const LIGHT_OPTIONS = ['none', 'glow'] as const;

const chipCls = (active: boolean) =>
    cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
            ? 'border-violet-500 bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100'
            : 'text-muted-foreground hover:text-foreground'
    );

const smallChipCls = (active: boolean) =>
    cn(
        'rounded-full border px-2 py-0.5 text-xs transition-colors',
        active
            ? 'border-violet-500 bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100'
            : 'text-muted-foreground hover:text-foreground'
    );

/** "Space Grotesk + Inter" → "Space Grotesk for headlines · Inter for body". */
function describePairing(label: string): string {
    const [display, body] = label.split(' + ');
    if (display && body) return `${display} for headlines · ${body} for body`;
    return label;
}

/**
 * Styleframe gate — approve the run's design identity (font pairing, motion
 * personality, finishing, color arc, image art direction) at the script
 * boundary, before any shot is styled. Every downstream shot inherits this
 * look, so this is the one moment to change the whole video's visual
 * signature. Only fields the user actually changed are sent back.
 */
export function StyleframeDecision({ decision, isSubmitting, onSubmit }: StyleframeDecisionProps) {
    const identity = useMemo<DesignIdentity | null>(
        () => decision.payload?.identity ?? null,
        [decision.payload]
    );
    const pairingOptions = useMemo(
        () => decision.payload?.pairing_options ?? [],
        [decision.payload]
    );
    const motionOptions = useMemo(() => decision.payload?.motion_options ?? [], [decision.payload]);

    // Edited picks; null = keep the drafted identity's value.
    const [pairingPick, setPairingPick] = useState<string | null>(null);
    const [motionPick, setMotionPick] = useState<string | null>(null);
    const [grainPick, setGrainPick] = useState<string | null>(null);
    const [vignettePick, setVignettePick] = useState<string | null>(null);
    const [lightPick, setLightPick] = useState<string | null>(null);
    const [colorArc, setColorArc] = useState(identity?.color_arc_note ?? '');
    const [imageArt, setImageArt] = useState(identity?.image_art_direction ?? '');
    const [advancedOpen, setAdvancedOpen] = useState(false);

    const activePairing = pairingPick ?? identity?.typography.pairing ?? '';
    const activeMotion = motionPick ?? identity?.motion.personality ?? '';
    const activeGrain = grainPick ?? identity?.finishing.grain ?? 'none';
    const activeVignette = vignettePick ?? identity?.finishing.vignette ?? 'none';
    const activeLight = lightPick ?? identity?.finishing.light ?? 'none';

    const activePairingOption = pairingOptions.find((o) => o.key === activePairing);
    const pairingCaption = activePairingOption
        ? describePairing(activePairingOption.label)
        : identity
          ? `${identity.typography.display} for headlines · ${identity.typography.body} for body`
          : '';

    // Only fields that differ from the drafted identity go into the edit.
    const edit = useMemo<DesignIdentityEdit>(() => {
        if (!identity) return {};
        const out: DesignIdentityEdit = {};
        if (activePairing !== identity.typography.pairing) out.font_pairing = activePairing;
        if (activeMotion !== identity.motion.personality) out.motion_personality = activeMotion;
        const finishing: NonNullable<DesignIdentityEdit['finishing']> = {};
        if (activeGrain !== identity.finishing.grain) finishing.grain = activeGrain;
        if (activeVignette !== identity.finishing.vignette) finishing.vignette = activeVignette;
        if (activeLight !== identity.finishing.light) finishing.light = activeLight;
        if (Object.keys(finishing).length > 0) out.finishing = finishing;
        if (colorArc !== identity.color_arc_note) out.color_arc_note = colorArc;
        if (imageArt !== identity.image_art_direction) out.image_art_direction = imageArt;
        return out;
    }, [
        identity,
        activePairing,
        activeMotion,
        activeGrain,
        activeVignette,
        activeLight,
        colorArc,
        imageArt,
    ]);
    const dirty = Object.keys(edit).length > 0;

    const approve = () => {
        if (dirty) {
            onSubmit({ kind: 'edit', gate_type: 'styleframe', identity: edit });
        } else {
            onSubmit({ kind: 'accept_recommended' });
        }
    };

    return (
        <div className="rounded-xl border bg-white shadow-sm dark:bg-card">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/30">
                        <Palette className="size-4 text-violet-600" />
                    </span>
                    Design identity
                    {identity?.identity_name ? (
                        <span className="truncate rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {identity.identity_name}
                        </span>
                    ) : null}
                </div>
                {identity?.rationale ? (
                    <span
                        className="min-w-0 max-w-56 truncate text-xs text-muted-foreground"
                        title={identity.rationale}
                    >
                        {identity.rationale}
                    </span>
                ) : null}
            </div>

            {!identity ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No design identity was attached to this decision.
                </div>
            ) : (
                <>
                    {identity.styleframe_url ? (
                        <div className="border-b px-4 py-3">
                            <img
                                src={identity.styleframe_url}
                                alt={`Styleframe — ${identity.identity_name}`}
                                loading="lazy"
                                className="max-h-64 w-full rounded-lg border object-cover"
                            />
                            <p className="mt-1.5 text-xs text-muted-foreground">
                                Styleframe — the look every shot follows
                            </p>
                        </div>
                    ) : (
                        <div className="border-b px-4 py-2.5 text-xs text-muted-foreground">
                            No styleframe rendered for this run
                        </div>
                    )}

                    <div className="space-y-1.5 border-b px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground">Typography</p>
                        {identity.typography.locked_by_brand ? (
                            <p className="flex items-center gap-1.5 text-sm text-foreground">
                                <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                                Locked by your brand kit: {identity.typography.display} /{' '}
                                {identity.typography.body}
                            </p>
                        ) : (
                            <>
                                <div className="flex flex-wrap gap-1.5">
                                    {pairingOptions.map((o) => (
                                        <button
                                            key={o.key}
                                            type="button"
                                            disabled={isSubmitting}
                                            title={o.vibe}
                                            onClick={() => setPairingPick(o.key)}
                                            className={chipCls(activePairing === o.key)}
                                        >
                                            {o.label}
                                        </button>
                                    ))}
                                </div>
                                {pairingCaption ? (
                                    <p className="text-xs text-muted-foreground">
                                        {pairingCaption}
                                    </p>
                                ) : null}
                            </>
                        )}
                    </div>

                    {motionOptions.length > 0 && (
                        <div className="space-y-1.5 border-b px-4 py-3">
                            <p className="text-xs font-medium text-muted-foreground">
                                Motion personality
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {motionOptions.map((o) => (
                                    <button
                                        key={o.key}
                                        type="button"
                                        disabled={isSubmitting}
                                        title={o.vibe}
                                        onClick={() => setMotionPick(o.key)}
                                        className={chipCls(activeMotion === o.key)}
                                    >
                                        {o.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-x-6 gap-y-2 border-b px-4 py-3">
                        {(
                            [
                                ['Grain', GRAIN_OPTIONS, activeGrain, setGrainPick],
                                ['Vignette', VIGNETTE_OPTIONS, activeVignette, setVignettePick],
                                ['Light', LIGHT_OPTIONS, activeLight, setLightPick],
                            ] as const
                        ).map(([label, options, active, set]) => (
                            <div key={label} className="space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {options.map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            disabled={isSubmitting}
                                            onClick={() => set(v)}
                                            className={smallChipCls(active === v)}
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2 px-4 py-3">
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setAdvancedOpen((v) => !v)}
                            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {advancedOpen ? (
                                <CaretDown className="size-3" />
                            ) : (
                                <CaretRight className="size-3" />
                            )}
                            Advanced
                        </button>
                        {advancedOpen && (
                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Color arc
                                    </p>
                                    <Textarea
                                        value={colorArc}
                                        disabled={isSubmitting}
                                        onChange={(e) => setColorArc(e.target.value)}
                                        rows={2}
                                        className="min-h-0 resize-y text-sm leading-relaxed"
                                        placeholder="How color evolves across the video"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Image art direction
                                    </p>
                                    <Textarea
                                        value={imageArt}
                                        disabled={isSubmitting}
                                        onChange={(e) => setImageArt(e.target.value)}
                                        rows={2}
                                        className="min-h-0 resize-y text-sm leading-relaxed"
                                        placeholder="How generated images should look"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
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
                    onClick={approve}
                    className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700"
                >
                    <Check className="size-4" />
                    {dirty ? 'Save & continue' : 'Approve & continue'}
                </Button>
            </div>
        </div>
    );
}
