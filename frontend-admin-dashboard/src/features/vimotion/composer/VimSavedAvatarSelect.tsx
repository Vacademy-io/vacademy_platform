import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Check, UserSquare2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getInstituteId } from '@/constants/helper';
import { listAvatars } from '@/features/vimotion/api/avatars';
import type { StudioAvatar } from '@/features/vimotion/api/dashboardTypes';
import { colorForInitials, getInitials } from '@/features/vimotion/avatars/catalog';

interface VimSavedAvatarSelectProps {
    /** Currently selected studio_avatar.id. */
    value: string | undefined;
    onChange: (avatarId: string | undefined, avatar: StudioAvatar | undefined) => void;
}

/**
 * Vim-mode replacement for the Host tab's free-form face image upload. Lists
 * saved studio avatars (custom + built-ins from Argil/VEED catalog) and emits
 * the picked id as `host.avatar.saved_avatar_id`. The BE resolver hydrates
 * provider/face_image_url/voice from the saved row.
 *
 * Empty state links to the Avatars tab — vim's contract is "save first, then
 * pick at generation time" rather than ad-hoc uploads (which is admin's flow).
 */
export function VimSavedAvatarSelect({ value, onChange }: VimSavedAvatarSelectProps) {
    const instituteId = getInstituteId();

    const avatarsQuery = useQuery({
        queryKey: ['vim-saved-avatars', instituteId],
        queryFn: () => listAvatars(instituteId!),
        enabled: !!instituteId,
        staleTime: 60_000,
    });

    const avatars = useMemo(() => avatarsQuery.data ?? [], [avatarsQuery.data]);

    if (avatarsQuery.isLoading) {
        return (
            <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="aspect-square animate-pulse rounded-md bg-neutral-100"
                    />
                ))}
            </div>
        );
    }

    if (avatarsQuery.isError) {
        return (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                Could not load saved avatars. Refresh and try again.
            </div>
        );
    }

    if (avatars.length === 0) {
        return (
            <div className="space-y-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50/60 p-3 text-center">
                <UserSquare2 className="mx-auto size-5 text-neutral-400" />
                <p className="text-[11px] text-neutral-600">No saved hosts yet.</p>
                <Link
                    to="/vim/dashboard"
                    search={{ tab: 'avatars' }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-900 hover:underline"
                >
                    Save your first host
                    <ArrowRight className="size-3" />
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <ul className="grid grid-cols-3 gap-2">
                {avatars.map((avatar) => {
                    const selected = avatar.id === value;
                    return (
                        <li key={avatar.id}>
                            <button
                                type="button"
                                onClick={() => onChange(avatar.id, avatar)}
                                className={cn(
                                    'group relative flex w-full flex-col overflow-hidden rounded-md border text-left transition-colors',
                                    selected
                                        ? 'border-neutral-900 ring-1 ring-neutral-900'
                                        : 'border-neutral-200 hover:border-neutral-300'
                                )}
                            >
                                <AvatarThumbnail avatar={avatar} />
                                <div className="space-y-0.5 p-1.5">
                                    <p className="truncate text-[10px] font-medium text-neutral-900">
                                        {avatar.name || 'Untitled'}
                                    </p>
                                    <ProviderBadge provider={avatar.provider} />
                                </div>
                                {selected && (
                                    <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-neutral-900 text-white">
                                        <Check className="size-2.5" />
                                    </span>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>
            <Link
                to="/vim/dashboard"
                search={{ tab: 'avatars' }}
                className="inline-flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-900"
            >
                Manage hosts
                <ArrowRight className="size-3" />
            </Link>
        </div>
    );
}

function AvatarThumbnail({ avatar }: { avatar: StudioAvatar }) {
    // Custom avatars carry a real face image; built-ins fall back to initials
    // since v1 doesn't self-host catalog frames yet (preview_image_url=null).
    const imageUrl = avatar.preview_image_url || avatar.face_image_url;
    if (imageUrl) {
        return (
            <div className="aspect-square w-full bg-neutral-100">
                <img
                    src={imageUrl}
                    alt={avatar.name}
                    className="size-full object-cover"
                    loading="lazy"
                />
            </div>
        );
    }
    const initials = getInitials(avatar.name);
    const bg = colorForInitials(avatar.name);
    return (
        <div
            className="flex aspect-square w-full items-center justify-center text-sm font-semibold text-neutral-700"
            style={{ background: bg }}
        >
            {initials}
        </div>
    );
}

function ProviderBadge({ provider }: { provider: StudioAvatar['provider'] }) {
    const label = provider === 'argil' ? 'Argil' : provider === 'veed' ? 'VEED' : 'Custom';
    const tone =
        provider === 'custom'
            ? 'bg-neutral-100 text-neutral-600'
            : 'bg-primary-50 text-primary-600';
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-sm px-1 py-0.5 text-[8px] font-medium uppercase tracking-wider',
                tone
            )}
        >
            {label}
        </span>
    );
}
