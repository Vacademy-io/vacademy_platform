/**
 * Hand-authored thin-line nav icon set for the main sidebar — a quieter,
 * single-weight outline replacing the Phosphor duotone/fill icons there.
 * Kept deliberately minimal (no fills, no texture) so they stay legible at
 * the 20-24px the sidebar renders them at and read as "quiet chrome" rather
 * than decoration, matching the reference aesthetic (thin hairlines, lots
 * of whitespace, no illustrated color). Sibling to — but a different medium
 * from — the felted-clay Dashboard-card illustrations, which are sized for
 * 44px+ surfaces and would lose all detail at nav scale.
 *
 * Each accepts the same { className, weight } shape the sidebar's
 * `React.createElement(icon, { weight, className })` call site already
 * passes to Phosphor icons — `weight` is accepted and ignored since these
 * icons express active/inactive state purely via `currentColor` (the
 * container already toggles text color on the active item).
 */
import type { SVGProps } from "react";

export type NavIconProps = {
  className?: string;
  weight?: unknown;
  /** Phosphor-compatible: some call sites size via prop instead of class. */
  size?: number | string;
};

const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function dims(size?: number | string) {
  // Default to 1em (Phosphor's behavior) so an unsized usage never
  // explodes to the SVG's intrinsic full width.
  return { width: size ?? "1em", height: size ?? "1em" };
}

export function NavHouseIcon({ className, size }: NavIconProps) {
  return (
    <svg {...base} {...dims(size)} className={className} aria-hidden="true">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function NavBookIcon({ className, size }: NavIconProps) {
  return (
    <svg {...base} {...dims(size)} className={className} aria-hidden="true">
      <path d="M12 6.5c-1.5-1.2-3.6-1.8-6-1.8-.6 0-1 .4-1 1v11c0 .6.4 1 1 1 2.4 0 4.5.6 6 1.8 1.5-1.2 3.6-1.8 6-1.8.6 0 1-.4 1-1v-11c0-.6-.4-1-1-1-2.4 0-4.5.6-6 1.8Z" />
      <path d="M12 6.5V19.5" />
    </svg>
  );
}

export function NavNotepadIcon({ className, size }: NavIconProps) {
  return (
    <svg {...base} {...dims(size)} className={className} aria-hidden="true">
      <rect x="4.5" y="3.5" width="12" height="16" rx="1.5" />
      <path d="M8 8h5M8 11.5h5M8 15h3" />
      <path d="M16 15.5 19.2 12.3a1.1 1.1 0 0 1 1.6 1.6L17.6 17l-2 .5.4-2Z" />
    </svg>
  );
}

export function NavClipboardCheckIcon({ className, size }: NavIconProps) {
  return (
    <svg {...base} {...dims(size)} className={className} aria-hidden="true">
      <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
      <path d="M9 4.5h6a1 1 0 0 1 1 1V7H8V5.5a1 1 0 0 1 1-1Z" />
      <path d="M9 12l2 2 4-4.5" />
    </svg>
  );
}

export function NavChatIcon({ className, size }: NavIconProps) {
  return (
    <svg {...base} {...dims(size)} className={className} aria-hidden="true">
      <path d="M12 4.5c-4.4 0-8 3.1-8 7 0 2.2 1.2 4.2 3 5.5-.1.9-.5 2-1.3 2.9 1.4 0 2.8-.5 3.9-1.3.7.2 1.5.4 2.4.4 4.4 0 8-3.1 8-7s-3.6-7-8-7Z" />
      <circle cx="9" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function NavGiftIcon({ className, size }: NavIconProps) {
  return (
    <svg {...base} {...dims(size)} className={className} aria-hidden="true">
      <rect x="4" y="8.5" width="16" height="4" rx="1" />
      <path d="M5.5 12.5v6a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-6" />
      <path d="M12 8.5v11" />
      <path d="M12 8.5c-1.8 0-3.8-.6-3.8-2.2 0-1.1.8-1.8 1.8-1.8 1.4 0 2 1.7 2 4Z" />
      <path d="M12 8.5c1.8 0 3.8-.6 3.8-2.2 0-1.1-.8-1.8-1.8-1.8-1.4 0-2 1.7-2 4Z" />
    </svg>
  );
}

export function NavCalendarCheckIcon({ className, size }: NavIconProps) {
  return (
    <svg {...base} {...dims(size)} className={className} aria-hidden="true">
      <rect x="4.5" y="5.5" width="15" height="14" rx="1.5" />
      <path d="M4.5 9.5h15" />
      <path d="M8.5 3.5v3M15.5 3.5v3" />
      <path d="M9.5 14l2 2 3.5-4" />
    </svg>
  );
}

export function NavUsersIcon({ className, size }: NavIconProps) {
  return (
    <svg {...base} {...dims(size)} className={className} aria-hidden="true">
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5c.6-3 2.9-4.7 5.5-4.7s4.9 1.7 5.5 4.7" />
      <circle cx="16.5" cy="9.5" r="2.4" />
      <path d="M15.5 14.9c2.3.2 4.3 1.7 5 4.6" />
    </svg>
  );
}
