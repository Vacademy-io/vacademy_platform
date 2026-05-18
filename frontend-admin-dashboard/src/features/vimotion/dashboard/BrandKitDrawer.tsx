import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Globe, X } from 'lucide-react';
import { VimotionLoader } from '../brand/VimotionLoader';
import { z } from 'zod';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ColorPickerField } from '@/routes/manage-pages/-components/ColorPickerField';
import { ImageUploadField } from '@/routes/manage-pages/-components/ImageUploadField';
import {
    fetchVideoTemplates,
    FONT_OPTIONS,
    type VideoTemplate,
} from '@/routes/video-api-studio/-services/video-style-branding';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { createBrandKit, scrapeBrandKitFromUrl, updateBrandKit } from '../api/brandKits';
import type {
    BrandKit,
    BrandKitScrapePreview,
    BrandKitWritePayload,
    WatermarkPosition,
} from '../api/dashboardTypes';

const brandKitSchema = z.object({
    name: z.string().trim().min(2, 'Name is required'),
    isDefault: z.boolean(),
    backgroundType: z.enum(['white', 'black']),
    palettePrimary: z.string().regex(/^#([0-9A-Fa-f]{6})$/, 'Pick a hex color'),
    paletteSecondary: z.string().regex(/^#([0-9A-Fa-f]{6})$/, 'Pick a hex color'),
    paletteAccent: z.string().regex(/^#([0-9A-Fa-f]{6})$/, 'Pick a hex color'),
    paletteBackground: z.string().regex(/^#([0-9A-Fa-f]{6})$/, 'Pick a hex color'),
    headingFont: z.string(),
    bodyFont: z.string(),
    layoutTheme: z.string(),
    logoFileId: z.string().optional(),
    introEnabled: z.boolean(),
    introDuration: z.number().min(0).max(30),
    introHtml: z.string(),
    outroEnabled: z.boolean(),
    outroDuration: z.number().min(0).max(30),
    outroHtml: z.string(),
    watermarkEnabled: z.boolean(),
    watermarkPosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
    watermarkOpacity: z.number().min(0).max(1),
    watermarkHtml: z.string(),
});

type FormValues = z.infer<typeof brandKitSchema>;

const DEFAULT_VALUES: FormValues = {
    name: '',
    isDefault: false,
    backgroundType: 'white',
    palettePrimary: '#FF6B00',
    paletteSecondary: '#0F172A',
    paletteAccent: '#22D3EE',
    paletteBackground: '#FFFFFF',
    headingFont: 'Inter',
    bodyFont: 'Inter',
    layoutTheme: '',
    logoFileId: undefined,
    introEnabled: false,
    introDuration: 3,
    introHtml: '',
    outroEnabled: false,
    outroDuration: 4,
    outroHtml: '',
    watermarkEnabled: false,
    watermarkPosition: 'top-right',
    watermarkOpacity: 0.5,
    watermarkHtml: '',
};

// Maps a scraped draft (BrandKitWritePayload shape from the backend) onto the
// drawer's flat zod form values. Mirrors the kit-load useEffect — falls back
// to DEFAULT_VALUES on any missing field so the form never lands in a half-set
// state. Hex color guard catches LLM output that slipped past server-side
// coercion (rare but cheap to defend).
const HEX6 = /^#[0-9A-Fa-f]{6}$/;
function mapDraftToFormValues(draft: BrandKitWritePayload): FormValues {
    const hex = (v: string | undefined, fallback: string) => (v && HEX6.test(v) ? v : fallback);
    return {
        ...DEFAULT_VALUES,
        name: draft.name ?? DEFAULT_VALUES.name,
        isDefault: !!draft.is_default,
        backgroundType: draft.background_type ?? DEFAULT_VALUES.backgroundType,
        palettePrimary: hex(draft.palette?.primary, DEFAULT_VALUES.palettePrimary),
        paletteSecondary: hex(draft.palette?.secondary, DEFAULT_VALUES.paletteSecondary),
        paletteAccent: hex(draft.palette?.accent, DEFAULT_VALUES.paletteAccent),
        paletteBackground: hex(draft.palette?.background, DEFAULT_VALUES.paletteBackground),
        headingFont: draft.heading_font ?? DEFAULT_VALUES.headingFont,
        bodyFont: draft.body_font ?? DEFAULT_VALUES.bodyFont,
        layoutTheme: draft.layout_theme ?? '',
        logoFileId: draft.logo_file_id ?? undefined,
        introEnabled: !!draft.intro?.enabled,
        introDuration: draft.intro?.duration_seconds ?? DEFAULT_VALUES.introDuration,
        introHtml: draft.intro?.html ?? '',
        outroEnabled: !!draft.outro?.enabled,
        outroDuration: draft.outro?.duration_seconds ?? DEFAULT_VALUES.outroDuration,
        outroHtml: draft.outro?.html ?? '',
        watermarkEnabled: !!draft.watermark?.enabled,
        watermarkPosition: (draft.watermark?.position as WatermarkPosition) ?? 'top-right',
        watermarkOpacity: draft.watermark?.opacity ?? DEFAULT_VALUES.watermarkOpacity,
        watermarkHtml: draft.watermark?.html ?? '',
    };
}

const WATERMARK_POSITIONS: { value: WatermarkPosition; label: string }[] = [
    { value: 'top-left', label: 'Top left' },
    { value: 'top-right', label: 'Top right' },
    { value: 'bottom-left', label: 'Bottom left' },
    { value: 'bottom-right', label: 'Bottom right' },
];

interface BrandKitDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    instituteId: string;
    kit: BrandKit | null;
}

export function BrandKitDrawer({ open, onOpenChange, instituteId, kit }: BrandKitDrawerProps) {
    const queryClient = useQueryClient();
    const isEdit = kit != null;

    const form = useForm<FormValues>({
        resolver: zodResolver(brandKitSchema),
        defaultValues: DEFAULT_VALUES,
    });

    // "Blank vs From website" tab — only meaningful when creating a new kit.
    // Editing always uses the form directly (no scrape).
    const [mode, setMode] = useState<'blank' | 'website'>('blank');
    const [scrapeUrl, setScrapeUrl] = useState('');
    const [scrapePreview, setScrapePreview] = useState<BrandKitScrapePreview | null>(null);

    // Generation counter: bumped on every drawer open AND every kit change so a
    // stale scrape (kicked off in a previous session, still in flight when the
    // user closes the drawer and reopens it on a different kit) cannot overwrite
    // the form. The mutation captures the current sessionId at fire time and
    // checks it on success.
    const sessionIdRef = useRef(0);

    // Reset all scrape state whenever the drawer opens or the kit changes
    useEffect(() => {
        if (!open) return;
        sessionIdRef.current += 1;
        setMode('blank');
        setScrapeUrl('');
        setScrapePreview(null);
    }, [open, kit]);

    useEffect(() => {
        if (!open) return;
        if (kit) {
            form.reset({
                name: kit.name,
                isDefault: kit.is_default,
                backgroundType: kit.background_type,
                palettePrimary: kit.palette.primary ?? DEFAULT_VALUES.palettePrimary,
                paletteSecondary: kit.palette.secondary ?? DEFAULT_VALUES.paletteSecondary,
                paletteAccent: kit.palette.accent ?? DEFAULT_VALUES.paletteAccent,
                paletteBackground: kit.palette.background ?? DEFAULT_VALUES.paletteBackground,
                headingFont: kit.heading_font ?? 'Inter',
                bodyFont: kit.body_font ?? 'Inter',
                layoutTheme: kit.layout_theme ?? '',
                logoFileId: kit.logo_file_id ?? undefined,
                introEnabled: !!kit.intro?.enabled,
                introDuration: kit.intro?.duration_seconds ?? 3,
                introHtml: kit.intro?.html ?? '',
                outroEnabled: !!kit.outro?.enabled,
                outroDuration: kit.outro?.duration_seconds ?? 4,
                outroHtml: kit.outro?.html ?? '',
                watermarkEnabled: !!kit.watermark?.enabled,
                watermarkPosition: (kit.watermark?.position as WatermarkPosition) ?? 'top-right',
                watermarkOpacity: kit.watermark?.opacity ?? 0.5,
                watermarkHtml: kit.watermark?.html ?? '',
            });
        } else {
            form.reset(DEFAULT_VALUES);
        }
    }, [open, kit, form]);

    const templatesQuery = useQuery({
        queryKey: ['video-templates'],
        queryFn: fetchVideoTemplates,
        staleTime: 30 * 60 * 1000,
        enabled: open,
    });

    const scrape = useMutation({
        mutationFn: (vars: { url: string; sessionId: number }) =>
            scrapeBrandKitFromUrl(vars.url, instituteId),
        onSuccess: (result, vars) => {
            // Drop results from a stale session — the user may have reopened
            // the drawer (different kit, or the same kit after closing).
            if (vars.sessionId !== sessionIdRef.current) return;
            form.reset(mapDraftToFormValues(result.draft));
            setScrapePreview(result.preview);
            setMode('blank');
            const host = (() => {
                try {
                    return new URL(result.preview.source_url).hostname;
                } catch {
                    return result.preview.source_url;
                }
            })();
            toast.success(`Brand kit drafted from ${host} — review & save`);
            if (result.warnings && result.warnings.length > 0) {
                toast.warning(result.warnings[0]);
            }
        },
        onError: (err: unknown) => {
            const status = (err as { response?: { status?: number } })?.response?.status;
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
                ?.detail;
            const msg =
                detail ||
                (status === 401
                    ? 'You need to sign in to scrape websites.'
                    : err instanceof Error
                      ? err.message
                      : 'Could not import brand from this URL.');
            toast.error(msg);
        },
    });

    const onScrape = () => {
        const url = scrapeUrl.trim();
        if (!url) return;
        const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        try {
            // eslint-disable-next-line no-new
            new URL(normalized);
        } catch {
            toast.error('Enter a valid URL (e.g. https://acme.com).');
            return;
        }
        scrape.mutate({ url: normalized, sessionId: sessionIdRef.current });
    };

    const save = useMutation({
        mutationFn: async (values: FormValues) => {
            const payload = {
                name: values.name,
                is_default: values.isDefault,
                background_type: values.backgroundType,
                palette: {
                    primary: values.palettePrimary,
                    secondary: values.paletteSecondary,
                    accent: values.paletteAccent,
                    background: values.paletteBackground,
                },
                heading_font: values.headingFont,
                body_font: values.bodyFont,
                layout_theme: values.layoutTheme || undefined,
                logo_file_id: values.logoFileId || undefined,
                intro: {
                    enabled: values.introEnabled,
                    duration_seconds: values.introDuration,
                    html: values.introHtml,
                },
                outro: {
                    enabled: values.outroEnabled,
                    duration_seconds: values.outroDuration,
                    html: values.outroHtml,
                },
                watermark: {
                    enabled: values.watermarkEnabled,
                    position: values.watermarkPosition,
                    opacity: values.watermarkOpacity,
                    html: values.watermarkHtml,
                },
            };
            return isEdit
                ? updateBrandKit(kit!.id, instituteId, payload)
                : createBrandKit(instituteId, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vimotion-brand-kits', instituteId] });
            toast.success(isEdit ? 'Brand kit updated' : 'Brand kit created');
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to save brand kit';
            toast.error(msg);
        },
    });

    const onSubmit = (values: FormValues) => save.mutate(values);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                <SheetHeader>
                    <SheetTitle>{isEdit ? 'Edit brand kit' : 'New brand kit'}</SheetTitle>
                    <SheetDescription>
                        Bundles of palette, fonts, layout, and intro/outro/watermark you can apply
                        to any video.
                    </SheetDescription>
                </SheetHeader>

                {!isEdit && (
                    <Tabs
                        value={mode}
                        onValueChange={(v) => setMode(v as 'blank' | 'website')}
                        className="mt-4"
                    >
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="blank">Blank</TabsTrigger>
                            <TabsTrigger value="website">From website</TabsTrigger>
                        </TabsList>
                    </Tabs>
                )}

                {!isEdit && mode === 'website' ? (
                    <div className="mt-6 space-y-4">
                        <div className="space-y-2">
                            <label
                                htmlFor="brand-scrape-url"
                                className="text-sm font-medium text-neutral-800"
                            >
                                Website URL
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    id="brand-scrape-url"
                                    placeholder="https://acme.com"
                                    className="h-10"
                                    value={scrapeUrl}
                                    onChange={(e) => setScrapeUrl(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !scrape.isPending) {
                                            e.preventDefault();
                                            onScrape();
                                        }
                                    }}
                                    disabled={scrape.isPending}
                                />
                                <Button
                                    type="button"
                                    onClick={onScrape}
                                    disabled={scrape.isPending || !scrapeUrl.trim()}
                                    className="bg-neutral-900 text-white hover:bg-neutral-800"
                                >
                                    {scrape.isPending ? (
                                        <>
                                            <VimotionLoader size={16} className="mr-2 text-white" label="Scraping" />
                                            Scraping…
                                        </>
                                    ) : (
                                        <>
                                            <Globe className="mr-2 size-4" />
                                            Scrape
                                        </>
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-neutral-500">
                                We&apos;ll pull palette, fonts, logo, and draft intro/outro blocks.
                                Make sure you own the rights to assets at this URL.
                            </p>
                        </div>
                        {scrape.isPending && (
                            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
                                <VimotionLoader size={40} className="mx-auto text-neutral-900" label="Loading the page" />
                                <p className="mt-3 text-sm text-neutral-600">
                                    Loading the page, extracting brand signals, and asking the
                                    designer model — usually 15–30 seconds.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
                            {scrapePreview && (
                                <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                                    {scrapePreview.logo_url ? (
                                        <img
                                            src={scrapePreview.logo_url}
                                            alt=""
                                            className="size-12 shrink-0 rounded-md bg-white object-contain ring-1 ring-neutral-200"
                                        />
                                    ) : (
                                        <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-white text-neutral-400 ring-1 ring-neutral-200">
                                            <Globe className="size-5" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs uppercase tracking-wider text-neutral-500">
                                            Pulled from
                                        </p>
                                        <p className="truncate text-sm font-medium text-neutral-900">
                                            {scrapePreview.source_url}
                                        </p>
                                        <p className="mt-0.5 text-xs text-neutral-500">
                                            Review the fields below — every value is editable.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setScrapePreview(null)}
                                        aria-label="Dismiss source preview"
                                        className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                                    >
                                        <X className="size-4" />
                                    </button>
                                </div>
                            )}
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kit name</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g. Default, Conference, Demo"
                                                className="h-10"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="isDefault"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3">
                                        <div>
                                            <FormLabel className="font-medium">
                                                Default for this studio
                                            </FormLabel>
                                            <p className="text-xs text-neutral-500">
                                                Used when no kit is explicitly selected at video-gen
                                                time.
                                            </p>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            {/* Background */}
                            <FormField
                                control={form.control}
                                name="backgroundType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Background</FormLabel>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['white', 'black'] as const).map((v) => (
                                                <button
                                                    key={v}
                                                    type="button"
                                                    onClick={() => field.onChange(v)}
                                                    className={cn(
                                                        'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                                                        field.value === v
                                                            ? 'border-neutral-900 text-neutral-900'
                                                            : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                                                    )}
                                                >
                                                    {v === 'white' ? 'Light' : 'Dark'}
                                                </button>
                                            ))}
                                        </div>
                                    </FormItem>
                                )}
                            />

                            {/* Palette */}
                            <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
                                <p className="text-sm font-medium text-neutral-700">Palette</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Controller
                                        control={form.control}
                                        name="palettePrimary"
                                        render={({ field }) => (
                                            <ColorPickerField
                                                label="Primary"
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        )}
                                    />
                                    <Controller
                                        control={form.control}
                                        name="paletteSecondary"
                                        render={({ field }) => (
                                            <ColorPickerField
                                                label="Secondary"
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        )}
                                    />
                                    <Controller
                                        control={form.control}
                                        name="paletteAccent"
                                        render={({ field }) => (
                                            <ColorPickerField
                                                label="Accent"
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        )}
                                    />
                                    <Controller
                                        control={form.control}
                                        name="paletteBackground"
                                        render={({ field }) => (
                                            <ColorPickerField
                                                label="Background"
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Fonts */}
                            <div className="grid grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name="headingFont"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Heading font</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-10">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {FONT_OPTIONS.map((f) => (
                                                        <SelectItem key={f} value={f}>
                                                            {f}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="bodyFont"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Body font</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-10">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {FONT_OPTIONS.map((f) => (
                                                        <SelectItem key={f} value={f}>
                                                            {f}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Layout theme */}
                            <Controller
                                control={form.control}
                                name="layoutTheme"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Layout theme</FormLabel>
                                        <LayoutThemePicker
                                            value={field.value}
                                            onChange={field.onChange}
                                            templates={templatesQuery.data ?? []}
                                            loading={templatesQuery.isLoading}
                                        />
                                    </FormItem>
                                )}
                            />

                            {/* Logo */}
                            <FormField
                                control={form.control}
                                name="logoFileId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <ImageUploadField
                                                label="Studio logo (optional)"
                                                value={field.value ?? ''}
                                                onChange={(url) => field.onChange(url)}
                                                placeholder="Upload your logo"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            {/* Intro */}
                            <IntroOutroBlock
                                label="Intro"
                                enabledName="introEnabled"
                                durationName="introDuration"
                                htmlName="introHtml"
                                form={form}
                            />

                            {/* Outro */}
                            <IntroOutroBlock
                                label="Outro"
                                enabledName="outroEnabled"
                                durationName="outroDuration"
                                htmlName="outroHtml"
                                form={form}
                            />

                            {/* Watermark */}
                            <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
                                <FormField
                                    control={form.control}
                                    name="watermarkEnabled"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center justify-between">
                                            <FormLabel className="font-medium">Watermark</FormLabel>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                {form.watch('watermarkEnabled') && (
                                    <div className="mt-3 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormField
                                                control={form.control}
                                                name="watermarkPosition"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs text-neutral-500">
                                                            Position
                                                        </FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="h-10">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {WATERMARK_POSITIONS.map((p) => (
                                                                    <SelectItem
                                                                        key={p.value}
                                                                        value={p.value}
                                                                    >
                                                                        {p.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="watermarkOpacity"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs text-neutral-500">
                                                            Opacity ({field.value.toFixed(2)})
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="range"
                                                                min={0}
                                                                max={1}
                                                                step={0.05}
                                                                value={field.value}
                                                                onChange={(e) =>
                                                                    field.onChange(
                                                                        Number(e.target.value)
                                                                    )
                                                                }
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="watermarkHtml"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs text-neutral-500">
                                                        HTML
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            rows={4}
                                                            placeholder='<img src="https://..." />'
                                                            className="font-mono text-xs"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                            </div>

                            <SheetFooter className="gap-2 sm:gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={save.isPending}
                                    className="bg-neutral-900 text-white hover:bg-neutral-800"
                                >
                                    {save.isPending
                                        ? 'Saving…'
                                        : isEdit
                                          ? 'Save changes'
                                          : 'Create kit'}
                                </Button>
                            </SheetFooter>
                        </form>
                    </Form>
                )}
            </SheetContent>
        </Sheet>
    );
}

interface IntroOutroBlockProps {
    label: string;
    enabledName: 'introEnabled' | 'outroEnabled';
    durationName: 'introDuration' | 'outroDuration';
    htmlName: 'introHtml' | 'outroHtml';
    form: ReturnType<typeof useForm<FormValues>>;
}

function IntroOutroBlock({
    label,
    enabledName,
    durationName,
    htmlName,
    form,
}: IntroOutroBlockProps) {
    const enabled = form.watch(enabledName);
    return (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
            <FormField
                control={form.control}
                name={enabledName}
                render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                        <FormLabel className="font-medium">{label}</FormLabel>
                        <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                    </FormItem>
                )}
            />
            {enabled && (
                <div className="mt-3 space-y-3">
                    <FormField
                        control={form.control}
                        name={durationName}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs text-neutral-500">
                                    Duration (seconds)
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={30}
                                        step={0.5}
                                        className="h-10"
                                        value={field.value}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={htmlName}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs text-neutral-500">HTML</FormLabel>
                                <FormControl>
                                    <Textarea
                                        rows={6}
                                        placeholder="Full HTML/CSS for this segment"
                                        className="font-mono text-xs"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            )}
        </div>
    );
}

interface LayoutThemePickerProps {
    value: string;
    onChange: (next: string) => void;
    templates: VideoTemplate[];
    loading: boolean;
}

function LayoutThemePicker({ value, onChange, templates, loading }: LayoutThemePickerProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="h-24 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50"
                    />
                ))}
            </div>
        );
    }
    const options = [{ id: '', name: 'Default', description: 'Minimal styling' }, ...templates];
    return (
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
            {options.map((t) => {
                const selected = value === t.id;
                return (
                    <button
                        key={t.id || 'default'}
                        type="button"
                        onClick={() => onChange(t.id)}
                        className={cn(
                            'rounded-lg border p-3 text-left transition-colors',
                            selected
                                ? 'border-neutral-900 bg-white'
                                : 'border-neutral-200 bg-white hover:border-neutral-300'
                        )}
                    >
                        <p className="text-sm font-medium text-neutral-900">{t.name}</p>
                        {'description' in t && t.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                                {t.description}
                            </p>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
