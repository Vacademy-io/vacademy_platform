import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { Check } from 'lucide-react';
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
import { ImageUploadField } from '@/routes/manage-pages/-components/ImageUploadField';
import { fetchTtsVoices } from '@/routes/video-api-studio/-services/video-generation';
import { cn } from '@/lib/utils';
import { createAvatar, updateAvatar } from '../api/avatars';
import type { AvatarProvider, StudioAvatar } from '../api/dashboardTypes';
import {
    AVATAR_CATALOG,
    type CatalogEntry,
    colorForInitials,
    findCatalogEntry,
    getInitials,
} from '../avatars/catalog';

const avatarSchema = z
    .object({
        mode: z.enum(['custom', 'built-in']),
        name: z.string().trim().min(2, 'Avatar name is required'),
        // custom-mode
        faceImageUrl: z.string().optional(),
        // built-in mode
        provider: z.enum(['argil', 'veed']).optional(),
        externalAvatarId: z.string().optional(),
        // shared
        description: z.string().optional(),
        voiceLanguage: z.string(),
        voiceGender: z.enum(['female', 'male']),
        voiceTier: z.enum(['standard', 'premium']),
        voiceId: z.string().optional(),
    })
    .superRefine((v, ctx) => {
        if (v.mode === 'custom' && !v.faceImageUrl) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['faceImageUrl'],
                message: 'Face image is required',
            });
        }
        if (v.mode === 'built-in' && (!v.provider || !v.externalAvatarId)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['externalAvatarId'],
                message: 'Pick an avatar from the catalog',
            });
        }
    });

type FormValues = z.infer<typeof avatarSchema>;

interface AvatarDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    instituteId: string;
    avatar: StudioAvatar | null;
}

const COMMON_LANGUAGES = [
    'English (US)',
    'English (UK)',
    'English (India)',
    'Hindi',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese (Brazil)',
    'Japanese',
    'Korean',
];

const DEFAULT_VALUES: FormValues = {
    mode: 'built-in',
    name: '',
    faceImageUrl: '',
    provider: 'argil',
    externalAvatarId: undefined,
    description: '',
    voiceLanguage: 'English (US)',
    voiceGender: 'female',
    voiceTier: 'standard',
    voiceId: undefined,
};

export function AvatarDrawer({ open, onOpenChange, instituteId, avatar }: AvatarDrawerProps) {
    const queryClient = useQueryClient();
    const isEdit = avatar != null;

    const form = useForm<FormValues>({
        resolver: zodResolver(avatarSchema),
        defaultValues: DEFAULT_VALUES,
    });

    useEffect(() => {
        if (!open) return;
        if (avatar) {
            const isBuiltIn = avatar.provider !== 'custom';
            form.reset({
                mode: isBuiltIn ? 'built-in' : 'custom',
                name: avatar.name,
                faceImageUrl: avatar.face_image_url ?? '',
                provider: isBuiltIn ? (avatar.provider as 'argil' | 'veed') : 'argil',
                externalAvatarId: avatar.external_avatar_id ?? undefined,
                description: avatar.description ?? '',
                voiceLanguage: avatar.voice_language ?? 'English (US)',
                voiceGender: (avatar.voice_gender as 'female' | 'male' | undefined) ?? 'female',
                voiceTier: 'standard',
                voiceId: avatar.voice_id ?? undefined,
            });
        } else {
            form.reset(DEFAULT_VALUES);
        }
    }, [open, avatar, form]);

    const language = form.watch('voiceLanguage');
    const gender = form.watch('voiceGender');
    const tier = form.watch('voiceTier');

    const voicesQuery = useQuery({
        queryKey: ['tts-voices', language, gender, tier],
        queryFn: () => fetchTtsVoices(language, gender, tier),
        enabled: open,
        staleTime: 5 * 60 * 1000,
    });
    const voices = useMemo(() => voicesQuery.data?.voices ?? [], [voicesQuery.data]);

    const save = useMutation({
        mutationFn: async (values: FormValues) => {
            const provider: AvatarProvider =
                values.mode === 'custom' ? 'custom' : values.provider ?? 'argil';
            const voiceProvider = voices.find((v) => v.id === values.voiceId)?.provider;
            const payload = {
                name: values.name,
                provider,
                external_avatar_id:
                    values.mode === 'built-in' ? values.externalAvatarId : undefined,
                face_image_url: values.mode === 'custom' ? values.faceImageUrl : undefined,
                description: values.description?.trim() || undefined,
                voice_id: values.voiceId,
                voice_provider: voiceProvider,
                voice_language: values.voiceLanguage,
                voice_gender: values.voiceGender,
            };
            return isEdit
                ? updateAvatar(avatar!.id, instituteId, payload)
                : createAvatar(instituteId, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vimotion-avatars', instituteId] });
            toast.success(isEdit ? 'Avatar updated' : 'Avatar created');
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to save avatar';
            toast.error(msg);
        },
    });

    const onSubmit = (values: FormValues) => save.mutate(values);

    const mode = form.watch('mode');

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                <SheetHeader>
                    <SheetTitle>{isEdit ? 'Edit avatar' : 'New avatar'}</SheetTitle>
                    <SheetDescription>
                        Saved avatars can be reused as the on-screen host of any video.
                    </SheetDescription>
                </SheetHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-5">
                        {/* Mode toggle */}
                        <FormField
                            control={form.control}
                            name="mode"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="grid grid-cols-2 gap-2">
                                        <ModeButton
                                            label="Built-in"
                                            sub="Pick from fal.ai catalog"
                                            selected={field.value === 'built-in'}
                                            onClick={() => field.onChange('built-in')}
                                        />
                                        <ModeButton
                                            label="Custom"
                                            sub="Upload your own face"
                                            selected={field.value === 'custom'}
                                            onClick={() => field.onChange('custom')}
                                        />
                                    </div>
                                </FormItem>
                            )}
                        />

                        {mode === 'built-in' ? (
                            <BuiltInPicker form={form} />
                        ) : (
                            <FormField
                                control={form.control}
                                name="faceImageUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <ImageUploadField
                                                label="Face image"
                                                value={field.value ?? ''}
                                                onChange={(url) => field.onChange(url)}
                                                placeholder="Upload a clear, front-facing photo"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder={
                                                mode === 'built-in'
                                                    ? 'e.g. Marketing host'
                                                    : 'e.g. Sarah — explainer host'
                                            }
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
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Description{' '}
                                        <span className="font-normal text-neutral-400">
                                            (optional)
                                        </span>
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea
                                            rows={3}
                                            placeholder="e.g. navy blazer, neutral office background, mid-30s"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
                            <p className="mb-3 text-sm font-medium text-neutral-700">Voice</p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="voiceLanguage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-neutral-500">
                                                Language
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
                                                    {COMMON_LANGUAGES.map((l) => (
                                                        <SelectItem key={l} value={l}>
                                                            {l}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="voiceGender"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-neutral-500">
                                                Gender
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
                                                    <SelectItem value="female">Female</SelectItem>
                                                    <SelectItem value="male">Male</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="voiceTier"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-neutral-500">
                                                Tier
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
                                                    <SelectItem value="standard">
                                                        Standard
                                                    </SelectItem>
                                                    <SelectItem value="premium">Premium</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="voiceId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-neutral-500">
                                                Voice
                                            </FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value ?? ''}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-10">
                                                        <SelectValue
                                                            placeholder={
                                                                voicesQuery.isLoading
                                                                    ? 'Loading…'
                                                                    : voices.length === 0
                                                                      ? 'No voices'
                                                                      : 'Pick a voice'
                                                            }
                                                        />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {voices.map((v) => (
                                                        <SelectItem key={v.id} value={v.id}>
                                                            {v.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <p className="mt-3 text-xs text-neutral-500">
                                Voice is optional — leave empty to let the system pick a default at
                                video-gen time.
                            </p>
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
                                      : 'Create avatar'}
                            </Button>
                        </SheetFooter>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    );
}

interface ModeButtonProps {
    label: string;
    sub: string;
    selected: boolean;
    onClick: () => void;
}

function ModeButton({ label, sub, selected, onClick }: ModeButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                selected
                    ? 'border-neutral-900 shadow-[0_0_0_3px_rgba(0,0,0,0.04)]'
                    : 'border-neutral-200 hover:border-neutral-300'
            )}
        >
            <p className="text-sm font-medium text-neutral-900">{label}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>
        </button>
    );
}

interface BuiltInPickerProps {
    form: ReturnType<typeof useForm<FormValues>>;
}

function BuiltInPicker({ form }: BuiltInPickerProps) {
    const provider = form.watch('provider') ?? 'argil';
    const externalAvatarId = form.watch('externalAvatarId');
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return AVATAR_CATALOG.filter((e) => e.provider === provider).filter((e) => {
            if (!q) return true;
            return (
                e.name.toLowerCase().includes(q) ||
                e.externalAvatarId.toLowerCase().includes(q) ||
                (e.category ?? '').toLowerCase().includes(q)
            );
        });
    }, [provider, search]);

    return (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
            <div className="flex items-center gap-2">
                {(['argil', 'veed'] as const).map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => {
                            form.setValue('provider', p);
                            form.setValue('externalAvatarId', undefined);
                        }}
                        className={cn(
                            'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                            provider === p
                                ? 'border-neutral-900 bg-white text-neutral-900'
                                : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
                        )}
                    >
                        {p === 'argil' ? 'Argil' : 'VEED'}
                    </button>
                ))}
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search avatars…"
                    className="ml-auto h-8 w-44"
                />
            </div>

            <FormField
                control={form.control}
                name="externalAvatarId"
                render={({ field }) => (
                    <FormItem>
                        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
                            {filtered.map((entry) => {
                                const selected = entry.externalAvatarId === externalAvatarId;
                                return (
                                    <button
                                        key={entry.externalAvatarId}
                                        type="button"
                                        onClick={() => {
                                            field.onChange(entry.externalAvatarId);
                                            // Pre-fill name when blank, so users get sensible defaults.
                                            if (!form.getValues('name'))
                                                form.setValue('name', entry.name);
                                        }}
                                        className={cn(
                                            'group relative flex flex-col items-center gap-1.5 rounded-lg border bg-white p-2.5 text-center transition-colors',
                                            selected
                                                ? 'border-neutral-900 shadow-[0_0_0_3px_rgba(0,0,0,0.04)]'
                                                : 'border-neutral-200 hover:border-neutral-300'
                                        )}
                                    >
                                        <Initials entry={entry} />
                                        <p className="line-clamp-1 w-full text-xs font-medium text-neutral-900">
                                            {entry.name}
                                        </p>
                                        {entry.category && (
                                            <p className="line-clamp-1 w-full text-[10px] uppercase tracking-wider text-neutral-400">
                                                {entry.category}
                                            </p>
                                        )}
                                        {selected && (
                                            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-neutral-900 text-white">
                                                <Check className="size-2.5" />
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                            {filtered.length === 0 && (
                                <p className="col-span-full py-6 text-center text-xs text-neutral-400">
                                    No avatars match &ldquo;{search}&rdquo;
                                </p>
                            )}
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}

function Initials({ entry }: { entry: CatalogEntry }) {
    return (
        <div
            className="flex size-12 items-center justify-center rounded-full text-sm font-semibold text-neutral-700"
            style={{ backgroundColor: colorForInitials(entry.externalAvatarId) }}
        >
            {getInitials(entry.name)}
        </div>
    );
}

// Re-export so consumer cards can render the same initials treatment.
export { findCatalogEntry };
