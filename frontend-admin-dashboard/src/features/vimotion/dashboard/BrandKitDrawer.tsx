import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { cn } from '@/lib/utils';
import { createBrandKit, updateBrandKit } from '../api/brandKits';
import type { BrandKit, WatermarkPosition } from '../api/dashboardTypes';

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

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
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
                                        <Select onValueChange={field.onChange} value={field.value}>
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
                                        <Select onValueChange={field.onChange} value={field.value}>
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
