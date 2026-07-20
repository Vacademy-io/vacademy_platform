import Avatar from "boring-avatars";
import { cn } from "@/lib/utils";

interface ChildAvatarProps {
  name: string;
  /** media file id or full URL for a real photo; falls back to a graphic avatar */
  fileId?: string | null;
  /** pixel size for the generated graphic (match the container box) */
  size?: number;
  className?: string;
}

/**
 * Friendly child avatar: a real photo when we have one, otherwise a colourful
 * illustrated character face (boring-avatars "beam"), distinct per child. Warmer
 * and more appealing to parents than flat initials. Shape is clipped by the
 * wrapping container (circle vs rounded-square).
 */
export function ChildAvatar({ name, fileId, size = 80, className }: ChildAvatarProps) {
  const isUrl = !!fileId && (fileId.startsWith("http://") || fileId.startsWith("https://"));
  if (isUrl) {
    return <img src={fileId!} alt="" aria-hidden className={cn("size-full object-cover", className)} />;
  }
  return (
    <div aria-hidden className={cn("flex size-full items-center justify-center", className)}>
      <Avatar size={size} name={name || "child"} variant="beam" square />
    </div>
  );
}
