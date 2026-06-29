import {
  BookOpen, Fire, Lightning, Star, Trophy, Medal, Crown, Rocket, Target,
  Heart, Confetti, GraduationCap, Lightbulb, Sparkle, Flag, CheckCircle,
} from "@phosphor-icons/react";
import type { IconProps, IconWeight } from "@phosphor-icons/react";
import { type FC, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getPublicUrl } from "@/services/upload_file";

/**
 * Curated badge icon set shared by every badge surface (the Play widget and the
 * standard-theme gamification panel). Names line up 1:1 with BADGE_ICON_NAMES in
 * services/badge-config.ts and the admin badge builder.
 */
export const BADGE_ICON_MAP: Record<string, FC<IconProps>> = {
  BookOpen, Fire, Lightning, Star, Trophy, Medal, Crown, Rocket, Target,
  Heart, Confetti, GraduationCap, Lightbulb, Sparkle, Flag, CheckCircle,
};

export function getBadgeIcon(name: string): FC<IconProps> {
  return BADGE_ICON_MAP[name] ?? Trophy;
}

/** A built-in icon = a known Phosphor name; anything else is a custom uploaded image (file id / URL). */
export function isBuiltInBadgeIcon(name: string | undefined | null): boolean {
  return !!name && name in BADGE_ICON_MAP;
}

/**
 * Renders a badge's visual: a built-in Phosphor icon when `icon` is a known name,
 * or the admin-uploaded image (resolved via getPublicUrl) otherwise. Falls back to
 * the Trophy icon while a custom image resolves.
 */
export const BadgeVisual: FC<{
  icon: string;
  size?: number;
  className?: string;
  weight?: IconWeight;
  /** When true (use inside a fixed-size circle), a custom image fills the container. */
  fill?: boolean;
}> = ({ icon, size = 22, className, weight = "fill", fill = false }) => {
  const builtIn = isBuiltInBadgeIcon(icon);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (builtIn || !icon) return;
    let active = true;
    getPublicUrl(icon)
      .then((u) => {
        if (active) setUrl(u || "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [icon, builtIn]);

  if (!builtIn && url) {
    return fill ? (
      <img src={url} alt="" className="h-full w-full rounded-full object-cover" />
    ) : (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  const Icon = builtIn ? getBadgeIcon(icon) : Trophy;
  return <Icon weight={weight} size={size} className={className} />;
};
