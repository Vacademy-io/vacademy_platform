/**
 * The artwork block of a post-submit thank-you screen: the admin's optional
 * image, then the chosen icon in the chosen accent.
 *
 * Shared by both surfaces that render an audience form — the standalone
 * /audience-response page and the catalogue's inline/modal LeadForm — so a
 * campaign looks the same wherever its form was filled. Only the surrounding
 * chrome (glass card vs catalogue tokens) differs between the two.
 */
import {
  CalendarBlank,
  Check,
  Confetti,
  Envelope,
  Heart,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type {
  AudiencePostSubmitConfiguration,
  PostSubmitIcon,
} from "../-utils/post-submit-config";
import { POST_SUBMIT_ICON_ACCENT_CLASS } from "../-utils/post-submit-styles";

const ICON_COMPONENTS: Record<Exclude<PostSubmitIcon, "none">, typeof Check> = {
  check: Check,
  confetti: Confetti,
  heart: Heart,
  envelope: Envelope,
  calendar: CalendarBlank,
};

interface PostSubmitArtworkProps {
  config: AudiencePostSubmitConfiguration;
  /** `sm` for the inline catalogue form, `lg` for the full page. */
  size?: "sm" | "lg";
  className?: string;
}

export const PostSubmitArtwork = ({
  config,
  size = "lg",
  className,
}: PostSubmitArtworkProps) => {
  const IconComponent =
    config.icon === "none" ? null : ICON_COMPONENTS[config.icon];
  const hasImage = Boolean(config.imageUrl.trim());

  if (!hasImage && !IconComponent) return null;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {hasImage && (
        <img
          src={config.imageUrl}
          alt=""
          loading="lazy"
          className={cn(
            "w-auto max-w-full rounded-lg object-contain",
            size === "lg" ? "max-h-32" : "max-h-20"
          )}
          // A broken image URL should leave no gap, not a torn-page icon.
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      {IconComponent && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full",
            POST_SUBMIT_ICON_ACCENT_CLASS[config.accent],
            size === "lg" ? "size-20" : "size-14"
          )}
        >
          <IconComponent
            className={size === "lg" ? "size-10" : "size-7"}
            weight="duotone"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
};

export default PostSubmitArtwork;
