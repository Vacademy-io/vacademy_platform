import {
    BookOpen, Fire, Lightning, Star, Trophy, Medal, Crown, Rocket, Target,
    Heart, Confetti, GraduationCap, Lightbulb, Sparkle, Flag, CheckCircle,
} from '@phosphor-icons/react';
import type { IconProps, IconWeight } from '@phosphor-icons/react';
import { type FC, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getPublicUrl } from '@/services/upload_file';
import { isLibraryToken, getLibraryUrl } from './badge-library';

/**
 * Shared badge icon map for the admin app. Names line up 1:1 with BADGE_ICON_NAMES
 * in badge-config.ts and with the learner-side map. Used by the Badges & Rewards
 * settings builder and the student "Award Badge" picker.
 */
export const BADGE_ICON_MAP: Record<string, FC<IconProps>> = {
    BookOpen, Fire, Lightning, Star, Trophy, Medal, Crown, Rocket, Target,
    Heart, Confetti, GraduationCap, Lightbulb, Sparkle, Flag, CheckCircle,
};

export function getBadgeIcon(name: string): FC<IconProps> {
    return BADGE_ICON_MAP[name] ?? Trophy;
}

/** Built-in = a known Phosphor name; anything else is a custom uploaded image (file id / URL). */
export function isBuiltInBadgeIcon(name: string | undefined | null): boolean {
    return !!name && name in BADGE_ICON_MAP;
}

/**
 * Renders a badge's visual, in priority order:
 *  1. a bundled library badge when `icon` is a `lib:` token,
 *  2. a built-in Phosphor icon when `icon` is a known name,
 *  3. the admin-uploaded image (resolved via getPublicUrl) otherwise.
 */
export const BadgeVisual: FC<{
    icon: string;
    size?: number;
    className?: string;
    weight?: IconWeight;
    /** When true (use inside a fixed-size circle), a custom image fills the container. */
    fill?: boolean;
}> = ({ icon, size = 24, className, weight = 'fill', fill = false }) => {
    const libUrl = isLibraryToken(icon) ? getLibraryUrl(icon) : undefined;
    const builtIn = isBuiltInBadgeIcon(icon);
    const [url, setUrl] = useState('');

    useEffect(() => {
        if (builtIn || libUrl || !icon) return;
        let active = true;
        getPublicUrl(icon)
            .then((u) => {
                if (active) setUrl(u || '');
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [icon, builtIn, libUrl]);

    // Library badges are full artwork (their own circular shape) — contain, don't crop.
    if (libUrl) {
        return fill ? (
            <img src={libUrl} alt="" className="h-full w-full object-contain" />
        ) : (
            <img
                src={libUrl}
                alt=""
                width={size}
                height={size}
                className={cn('object-contain', className)}
            />
        );
    }

    if (!builtIn && url) {
        return fill ? (
            <img src={url} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
            <img
                src={url}
                alt=""
                width={size}
                height={size}
                className={cn('rounded-full object-cover', className)}
            />
        );
    }
    const Icon = builtIn ? getBadgeIcon(icon) : Trophy;
    return <Icon weight={weight} size={size} className={className} />;
};
