/**
 * AI Page Wizard (Phase A) — "Create page with AI".
 * Brief + images → ai_service composes a full page as schema-bound JSON →
 * admin reviews the section list → Accept adds the page to the current
 * config (still a local change: user then saves the draft / publishes).
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Sparkle, CircleNotch, Trash, ArrowLeft, ArrowsClockwise, Plus } from '@phosphor-icons/react';
import { useToast } from '@/hooks/use-toast';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useEditorStore } from '../-stores/editor-store';
import { ImageUploadField } from './ImageUploadField';
import {
    generateAiPage, estimateAiPageCredits,
    AiPageImage, GeneratePageResponse,
} from '../-services/ai-page-service';
import { Component, Page } from '../-types/editor-types';

const PAGE_TYPES = [
    { key: 'homepage', label: 'Homepage' },
    { key: 'course-landing', label: 'Course landing' },
    { key: 'about', label: 'About us' },
    { key: 'admissions', label: 'Admissions' },
    { key: 'contact', label: 'Contact' },
];

/** "Try another direction" re-runs generation with a distinct design angle. */
const DIRECTIONS = [
    'Editorial and premium: serif-feeling hierarchy, generous whitespace, storytelling sections.',
    'Bold and conversion-focused: strong contrast, big stat chips, repeated CTAs, urgency.',
    'Minimal and calm: few colors, lots of air, short copy, quiet trust signals.',
];

type Step = 'brief' | 'assets' | 'confirm' | 'review';

export const AiPageWizard = ({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) => {
    const instituteId = getCurrentInstituteId();
    const { instituteDetails } = useInstituteDetailsStore();
    const { config, addPage } = useEditorStore();
    const { toast } = useToast();

    const [step, setStep] = useState<Step>('brief');
    const [brief, setBrief] = useState('');
    const [pageType, setPageType] = useState('homepage');
    const [useRealData, setUseRealData] = useState(true);
    const [images, setImages] = useState<AiPageImage[]>([]);
    const [pendingUrl, setPendingUrl] = useState('');
    const [directionIdx, setDirectionIdx] = useState(-1); // -1 = model's own choice
    const [result, setResult] = useState<GeneratePageResponse | null>(null);

    // Compact snapshot of real offerings from institute details (no new API)
    const courseSnapshot = useMemo(() => {
        const batches = (instituteDetails as any)?.batches_for_sessions || [];
        const seen = new Map<string, { name: string; level?: string }>();
        for (const b of batches) {
            const name = b?.package_dto?.package_name;
            if (name && !seen.has(name)) {
                seen.set(name, { name, level: b?.level?.level_name || undefined });
            }
        }
        return Array.from(seen.values()).slice(0, 25);
    }, [instituteDetails]);

    const terminology = useMemo(
        () => ({
            course: getTerminology(ContentTerms.Course, SystemTerms.Course),
            level: getTerminology(ContentTerms.Level, SystemTerms.Level),
            session: getTerminology(ContentTerms.Session, SystemTerms.Session),
            batch: getTerminology(ContentTerms.Batch, SystemTerms.Batch),
            learner: getTerminology(RoleTerms.Learner, SystemTerms.Learner),
        }),
        []
    );

    const { data: estimate } = useQuery({
        queryKey: ['aiPageEstimate', instituteId],
        queryFn: () => estimateAiPageCredits(),
        enabled: open && step === 'confirm',
    });

    const generateMutation = useMutation({
        mutationFn: (direction?: string) =>
            generateAiPage({
                brief,
                page_type: pageType,
                institute_name: (instituteDetails as any)?.institute_name || undefined,
                images,
                courses: useRealData ? courseSnapshot : [],
                terminology,
                direction,
            }),
        onSuccess: (data) => {
            setResult(data);
            setStep('review');
        },
        onError: (err: any) => {
            const detail = err?.response?.data?.detail;
            toast({
                title: 'Generation failed',
                description: typeof detail === 'string' ? detail : 'Please try again.',
                variant: 'destructive',
            });
        },
    });

    const reset = () => {
        setStep('brief');
        setBrief('');
        setPageType('homepage');
        setImages([]);
        setDirectionIdx(-1);
        setResult(null);
    };

    const handleClose = (next: boolean) => {
        if (!next && !generateMutation.isPending) reset();
        onOpenChange(next);
    };

    const tryAnotherDirection = () => {
        const nextIdx = (directionIdx + 1) % DIRECTIONS.length;
        setDirectionIdx(nextIdx);
        generateMutation.mutate(DIRECTIONS[nextIdx]);
    };

    const acceptPage = () => {
        if (!result || !config) return;
        // Ensure a unique route among existing pages
        const routes = new Set(config.pages.map((p) => p.route));
        let route = result.page.route || 'ai-page';
        let n = 2;
        while (routes.has(route)) route = `${result.page.route}-${n++}`;

        const page: Page = {
            id: result.page.id,
            route,
            title: result.page.title || undefined,
            components: result.page.components as Component[],
        } as Page;
        addPage(page);
        toast({
            title: 'Page added',
            description: 'Review it on the canvas, then Save and Publish when ready.',
        });
        handleClose(false);
    };

    const busy = generateMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkle className="size-4 text-primary-500" weight="duotone" />
                        Create page with AI
                    </DialogTitle>
                </DialogHeader>

                {step === 'brief' && (
                    <div className="space-y-4">
                        <div>
                            <Label className="text-xs">What kind of page?</Label>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {PAGE_TYPES.map((t) => (
                                    <button
                                        key={t.key}
                                        onClick={() => setPageType(t.key)}
                                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                            pageType === t.key
                                                ? 'border-primary-400 bg-primary-50 text-primary-500'
                                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs">Tell us about this page</Label>
                            <Textarea
                                value={brief}
                                onChange={(e) => setBrief(e.target.value)}
                                rows={6}
                                placeholder="e.g. A landing page for our Arduino course aimed at school students — highlight hands-on projects, the free trial class, and parent testimonials. Friendly but premium tone."
                                className="mt-1.5"
                            />
                            <p className="mt-1 text-caption text-gray-400">
                                Write in any language — the page copy will match it.
                            </p>
                        </div>
                        <div className="flex items-center justify-between rounded border bg-gray-50 p-3">
                            <div>
                                <Label className="text-xs">Use my real {terminology.course.toLowerCase()} data</Label>
                                <p className="text-caption text-gray-400">
                                    Copy will reference your actual offerings ({courseSnapshot.length} found)
                                </p>
                            </div>
                            <Switch checked={useRealData} onCheckedChange={setUseRealData} />
                        </div>
                    </div>
                )}

                {step === 'assets' && (
                    <div className="space-y-3">
                        <p className="text-xs text-gray-500">
                            Add photos, your logo, or banners — the AI places them where they fit.
                            All optional.
                        </p>
                        {images.map((img, i) => (
                            <div key={i} className="flex items-center gap-2 rounded border bg-gray-50 p-2">
                                <img src={img.url} alt="" className="size-12 shrink-0 rounded object-cover" />
                                <Input
                                    className="flex-1"
                                    value={img.caption || ''}
                                    placeholder="What is this image? (e.g. Our robotics lab)"
                                    onChange={(e) => {
                                        const next = [...images];
                                        next[i] = { ...next[i]!, caption: e.target.value };
                                        setImages(next);
                                    }}
                                />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="size-8 p-0 text-red-500"
                                    onClick={() => setImages(images.filter((_, j) => j !== i))}
                                >
                                    <Trash className="size-4" />
                                </Button>
                            </div>
                        ))}
                        {images.length < 8 && (
                            <div className="space-y-2">
                                {/* Buffer the field (its onChange fires per keystroke for
                                    typed URLs) and append only on explicit Add. */}
                                <ImageUploadField
                                    label="Add image"
                                    value={pendingUrl}
                                    onChange={setPendingUrl}
                                />
                                {pendingUrl && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setImages([...images, { url: pendingUrl, kind: 'photo' }]);
                                            setPendingUrl('');
                                        }}
                                    >
                                        <Plus className="mr-1 size-4" /> Add this image
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {step === 'confirm' && (
                    <div className="space-y-4">
                        <div className="rounded border bg-gray-50 p-3 text-xs text-gray-600">
                            <p className="font-medium text-gray-800">Ready to generate</p>
                            <p className="mt-1">
                                {PAGE_TYPES.find((t) => t.key === pageType)?.label} · {images.length} image
                                {images.length === 1 ? '' : 's'} ·{' '}
                                {useRealData ? `real ${terminology.course.toLowerCase()} data` : 'generic content'}
                            </p>
                        </div>
                        {estimate && (
                            <p className="text-xs text-gray-500">
                                Estimated cost:{' '}
                                <span className="font-semibold text-gray-800">
                                    {estimate.estimated_credits ?? '—'} credits
                                </span>
                                {typeof estimate.current_balance === 'number' && (
                                    <> · balance {estimate.current_balance}</>
                                )}
                                {estimate.sufficient === false && (
                                    <span className="ml-1 font-medium text-red-600">— insufficient balance</span>
                                )}
                            </p>
                        )}
                        {busy && (
                            <div className="flex items-center gap-2 rounded border border-primary-100 bg-primary-50 p-3 text-xs text-primary-500">
                                <CircleNotch className="size-4 animate-spin" />
                                Designing sections and writing your copy — usually under a minute…
                            </div>
                        )}
                    </div>
                )}

                {step === 'review' && result && (
                    <div className="space-y-3">
                        <p className="text-xs text-gray-500">
                            Draft ready — <span className="font-medium text-gray-800">{result.page.title || 'Untitled page'}</span>{' '}
                            with {result.page.components.length} sections:
                        </p>
                        <ol className="max-h-52 space-y-1 overflow-y-auto rounded border bg-gray-50 p-3">
                            {result.page.components.map((c, i) => (
                                <li key={c.id} className="text-xs text-gray-700">
                                    {i + 1}. {String(c.type).replace(/([A-Z])/g, ' $1').trim()}
                                </li>
                            ))}
                        </ol>
                        {result.warnings.length > 0 && (
                            <p className="text-caption text-warning-600">
                                {result.warnings.length} item(s) were auto-cleaned during validation.
                            </p>
                        )}
                        <p className="text-caption text-gray-400">
                            Accepting adds this page to your site as an unsaved change — review it on the
                            canvas, then Save and Publish.
                        </p>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    {step === 'brief' && (
                        <Button onClick={() => setStep('assets')} disabled={!brief.trim()}>
                            Next: images
                        </Button>
                    )}
                    {step === 'assets' && (
                        <>
                            <Button variant="ghost" onClick={() => setStep('brief')}>
                                <ArrowLeft className="mr-1 size-4" /> Back
                            </Button>
                            <Button onClick={() => setStep('confirm')}>Next: generate</Button>
                        </>
                    )}
                    {step === 'confirm' && (
                        <>
                            <Button variant="ghost" onClick={() => setStep('assets')} disabled={busy}>
                                <ArrowLeft className="mr-1 size-4" /> Back
                            </Button>
                            <Button
                                onClick={() => generateMutation.mutate(directionIdx >= 0 ? DIRECTIONS[directionIdx] : undefined)}
                                disabled={busy || estimate?.sufficient === false}
                            >
                                {busy ? (
                                    <CircleNotch className="mr-1 size-4 animate-spin" />
                                ) : (
                                    <Sparkle className="mr-1 size-4" />
                                )}
                                Generate page
                            </Button>
                        </>
                    )}
                    {step === 'review' && (
                        <>
                            <Button variant="ghost" onClick={tryAnotherDirection} disabled={busy}>
                                {busy ? (
                                    <CircleNotch className="mr-1 size-4 animate-spin" />
                                ) : (
                                    <ArrowsClockwise className="mr-1 size-4" />
                                )}
                                Try another direction
                            </Button>
                            <Button onClick={acceptPage} disabled={busy}>
                                <Plus className="mr-1 size-4" /> Add to site
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
