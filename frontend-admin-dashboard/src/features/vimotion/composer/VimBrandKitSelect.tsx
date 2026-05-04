import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Check, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInstituteId } from '@/constants/helper';
import { listBrandKits } from '@/features/vimotion/api/brandKits';
import type { BrandKit } from '@/features/vimotion/api/dashboardTypes';

interface VimBrandKitSelectProps {
    /** Currently selected brand_kit.id. */
    value: string | undefined;
    onChange: (kitId: string | undefined, kit: BrandKit | undefined) => void;
}

/**
 * Vim-mode replacement for the per-institute Style + Branding accordions in
 * the SettingsPopover Branding tab. Lists saved brand kits, defaults to the
 * one flagged is_default. Picked id flows into request.brand_kit_id; the BE
 * resolver hydrates the kit and replaces institute defaults entirely (no merge).
 */
export function VimBrandKitSelect({ value, onChange }: VimBrandKitSelectProps) {
    const instituteId = getInstituteId();

    const kitsQuery = useQuery({
        queryKey: ['vim-brand-kits', instituteId],
        queryFn: () => listBrandKits(instituteId!),
        enabled: !!instituteId,
        staleTime: 60_000,
    });

    const kits = useMemo(() => kitsQuery.data ?? [], [kitsQuery.data]);

    // Auto-select the default kit on first render once kits load. Without
    // this the first generation would silently fall through to the institute-
    // wide setting_json — surprising for users who explicitly created a
    // default kit.
    useEffect(() => {
        if (value || kits.length === 0) return;
        const def = kits.find((k) => k.is_default) ?? kits[0];
        if (def) onChange(def.id, def);
        // onChange intentionally omitted from deps — only re-run when the
        // user clears the selection or the kits list mutates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, kits]);

    if (kitsQuery.isLoading) {
        return (
            <div className="space-y-2">
                <div className="h-9 animate-pulse rounded-md bg-neutral-100" />
                <div className="h-9 animate-pulse rounded-md bg-neutral-100" />
            </div>
        );
    }

    if (kitsQuery.isError) {
        return (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                Could not load brand kits. Refresh and try again.
            </div>
        );
    }

    if (kits.length === 0) {
        return (
            <div className="space-y-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50/60 p-3 text-center">
                <Palette className="mx-auto size-5 text-neutral-400" />
                <p className="text-[11px] text-neutral-600">No brand kits yet.</p>
                <Link
                    to="/vim/dashboard"
                    search={{ tab: 'brand-kits' }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-900 hover:underline"
                >
                    Create your first kit
                    <ArrowRight className="size-3" />
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <ul className="space-y-1.5">
                {kits.map((kit) => {
                    const selected = kit.id === value;
                    return (
                        <li key={kit.id}>
                            <button
                                type="button"
                                onClick={() => onChange(kit.id, kit)}
                                className={cn(
                                    'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                                    selected
                                        ? 'border-neutral-900 bg-neutral-50'
                                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                                )}
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <KitSwatch kit={kit} />
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-medium text-neutral-900">
                                            {kit.name || 'Untitled kit'}
                                        </p>
                                        <p className="text-[10px] text-neutral-500">
                                            {kit.is_default ? 'Default · ' : ''}
                                            {kit.background_type === 'black' ? 'Dark' : 'Light'}
                                            {kit.layout_theme ? ` · ${kit.layout_theme}` : ''}
                                        </p>
                                    </div>
                                </div>
                                {selected && <Check className="size-4 shrink-0 text-neutral-900" />}
                            </button>
                        </li>
                    );
                })}
            </ul>
            <Link
                to="/vim/dashboard"
                search={{ tab: 'brand-kits' }}
                className="inline-flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-900"
            >
                Manage kits
                <ArrowRight className="size-3" />
            </Link>
        </div>
    );
}

function KitSwatch({ kit }: { kit: BrandKit }) {
    const primary = kit.palette?.primary || '#0a0a0a';
    const accent = kit.palette?.accent || kit.palette?.secondary || primary;
    return (
        <div
            className="size-8 shrink-0 overflow-hidden rounded-md ring-1 ring-neutral-200"
            aria-hidden
        >
            <div
                className="size-full"
                style={{
                    background: `linear-gradient(135deg, ${primary} 0%, ${accent} 100%)`,
                }}
            />
        </div>
    );
}
