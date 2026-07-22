import { cn } from "@/lib/utils";

interface ChildAvatarProps {
  name: string;
  /** media file id or full URL for a real photo; falls back to coloured initials */
  fileId?: string | null;
  /** pixel size — used to scale the initials to the container */
  size?: number;
  className?: string;
}

// A small, distinct palette so each child gets a stable, recognisable colour
// (token-based; picked by a hash of the name).
const PALETTE = [
  "bg-primary-100 text-primary-500",
  "bg-secondary-100 text-secondary-500",
  "bg-info-50 text-info-600",
  "bg-success-50 text-success-600",
  "bg-warning-50 text-warning-700",
  "bg-cp-gold-tint text-cp-gold",
  "bg-danger-50 text-danger-600",
] as const;

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * The child avatar. A real photo is used when available (a full URL); otherwise a
 * clean, per-child coloured-initials chip — distinct per child, so two children
 * are easy to tell apart. Fills its container; the wrapper controls the shape.
 */
export function ChildAvatar({ name, fileId, size, className }: ChildAvatarProps) {
  const isUrl = !!fileId && (fileId.startsWith("http://") || fileId.startsWith("https://"));
  if (isUrl) {
    return <img src={fileId!} alt="" aria-hidden className={cn("size-full object-cover", className)} />;
  }

  const clean = (name || "").trim();
  const initials =
    clean
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const tone = PALETTE[hashName(clean) % PALETTE.length];

  return (
    <span
      aria-hidden
      className={cn("flex size-full items-center justify-center font-semibold leading-none", tone, className)}
      // scale the initials to the avatar size (genuinely dynamic geometry)
      style={{ fontSize: (size ?? 40) * 0.4 }}
    >
      {initials}
    </span>
  );
}
