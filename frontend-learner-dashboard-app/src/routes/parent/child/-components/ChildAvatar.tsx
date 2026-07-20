import { cn } from "@/lib/utils";

interface ChildAvatarProps {
  name: string;
  /** media file id or full URL for a real photo; falls back to a cartoon avatar */
  fileId?: string | null;
  /** accepted for call-site convenience; the SVG scales to the container */
  size?: number;
  className?: string;
}

/**
 * A proper, friendly child avatar — a colourful cartoon character (DiceBear
 * "big-smile", the same avatar service the course cards use), unique per child.
 * A real photo is used when available. Fills its container; the wrapper controls
 * the shape (circle vs rounded-square).
 */
export function ChildAvatar({ name, fileId, className }: ChildAvatarProps) {
  const isUrl = !!fileId && (fileId.startsWith("http://") || fileId.startsWith("https://"));
  const seed = encodeURIComponent((name || "child").trim().toLowerCase());
  const src = isUrl
    ? fileId!
    : `https://api.dicebear.com/9.x/big-smile/svg?seed=${seed}`;
  return <img src={src} alt="" aria-hidden className={cn("size-full object-cover", className)} />;
}
