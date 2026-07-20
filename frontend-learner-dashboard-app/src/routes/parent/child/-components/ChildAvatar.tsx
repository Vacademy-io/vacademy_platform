import { cn } from "@/lib/utils";
import heroGreeting from "@/assets/cleaner-play/hero-greeting.webp";

interface ChildAvatarProps {
  name: string;
  /** media file id or full URL for a real photo; falls back to the mascot */
  fileId?: string | null;
  /** accepted for call-site convenience; the image scales to the container */
  size?: number;
  className?: string;
}

/**
 * The child avatar. A real photo is used when one is available (a full URL);
 * otherwise a single clean, friendly 3D mascot — the same warm `hero-greeting`
 * character the learner dashboard uses — is shown for every child, on a soft
 * branded circle. Fills its container; the wrapper controls the shape.
 */
export function ChildAvatar({ fileId, className }: ChildAvatarProps) {
  const isUrl = !!fileId && (fileId.startsWith("http://") || fileId.startsWith("https://"));

  if (isUrl) {
    return <img src={fileId!} alt="" aria-hidden className={cn("size-full object-cover", className)} />;
  }

  return (
    <span className={cn("flex size-full items-center justify-center bg-primary-50", className)}>
      <img src={heroGreeting} alt="" aria-hidden className="size-full object-contain p-0.5" />
    </span>
  );
}
