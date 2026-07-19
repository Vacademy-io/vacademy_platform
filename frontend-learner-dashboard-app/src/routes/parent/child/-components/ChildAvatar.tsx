import { cn } from "@/lib/utils";

interface ChildAvatarProps {
  name: string;
  /** media file id or full URL for a real photo; falls back to initials */
  fileId?: string | null;
  className?: string;
  /** font size class for the initials (match the box size) */
  textClassName?: string;
}

function initialsOf(name: string): string {
  return (name || "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Vibrant, distinct-per-child gradients (design tokens only).
const GRADIENTS = [
  "from-primary-400 to-secondary-400",
  "from-secondary-400 to-primary-500",
  "from-primary-300 to-primary-500",
  "from-secondary-300 to-secondary-500",
  "from-primary-500 to-secondary-300",
];
function pickGradient(name: string): string {
  let h = 0;
  for (const c of name || " ") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/**
 * Friendly child avatar: a real photo when we have one, otherwise the child's
 * initials on a soft warm circle. Cleaner and more personal than a generated
 * blob. Reused in the header, hero, and picker.
 */
export function ChildAvatar({ name, fileId, className, textClassName }: ChildAvatarProps) {
  // Shape (circle vs rounded-square) is controlled by the wrapping container's
  // overflow-hidden + rounding — the avatar just fills it.
  const isUrl = !!fileId && (fileId.startsWith("http://") || fileId.startsWith("https://"));
  if (isUrl) {
    return <img src={fileId!} alt="" aria-hidden className={cn("size-full object-cover", className)} />;
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-full items-center justify-center bg-gradient-to-br font-bold text-primary-50",
        pickGradient(name),
        textClassName,
        className,
      )}
    >
      {initialsOf(name) || "🙂"}
    </div>
  );
}
