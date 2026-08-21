// The per-type colour language for slide rows, shared by the flat per-chapter
// sidebar and the full course tree so the same colour means the same kind of
// content in both sidebar modes. The blue/amber/purple/teal/emerald core came
// from the flat sidebar (it lived there as a private helper); the rest of the
// slide types it didn't cover — assessments, audio, code, presentations,
// feedback — were falling through to grey, which is exactly the row a learner
// most wants to pick out of a long chapter.
//
// Hues are assigned by what the learner does, not by taste: watch (blue),
// listen (sky), read (amber), answer (purple), practise (teal), submit
// (emerald), sit an exam (rose), run code (indigo), present (cyan).

import type { Slide } from "@/hooks/study-library/use-slides";

export type SlideTypeColors = {
  /** Text colour for a type label. */
  text: string;
  /** Tinted surface — the icon chip's resting background. */
  bg: string;
  /** Solid fill, for the icon chip of the row the learner is on. */
  solid: string;
  /** Small round dot beside a type label. */
  dot: string;
  /** Icon colour on the tinted surface. */
  detailText: string;
};

// Every class is written out as a literal: Tailwind builds its stylesheet by
// scanning source text, so a composed `text-${hue}-700` would resolve at
// runtime to a class that was never generated.
const PALETTE: Record<string, SlideTypeColors> = {
  blue: {
    text: "text-blue-700",
    bg: "bg-blue-50",
    solid: "bg-blue-500",
    dot: "bg-blue-500",
    detailText: "text-blue-600",
  },
  sky: {
    text: "text-sky-700",
    bg: "bg-sky-50",
    solid: "bg-sky-500",
    dot: "bg-sky-500",
    detailText: "text-sky-600",
  },
  amber: {
    text: "text-amber-700",
    bg: "bg-amber-50",
    solid: "bg-amber-500",
    dot: "bg-amber-500",
    detailText: "text-amber-600",
  },
  purple: {
    text: "text-purple-700",
    bg: "bg-purple-50",
    solid: "bg-purple-500",
    dot: "bg-purple-500",
    detailText: "text-purple-600",
  },
  teal: {
    text: "text-teal-700",
    bg: "bg-teal-50",
    solid: "bg-teal-500",
    dot: "bg-teal-500",
    detailText: "text-teal-600",
  },
  emerald: {
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    solid: "bg-emerald-500",
    dot: "bg-emerald-500",
    detailText: "text-emerald-600",
  },
  rose: {
    text: "text-rose-700",
    bg: "bg-rose-50",
    solid: "bg-rose-500",
    dot: "bg-rose-500",
    detailText: "text-rose-600",
  },
  indigo: {
    text: "text-indigo-700",
    bg: "bg-indigo-50",
    solid: "bg-indigo-500",
    dot: "bg-indigo-500",
    detailText: "text-indigo-600",
  },
  cyan: {
    text: "text-cyan-700",
    bg: "bg-cyan-50",
    solid: "bg-cyan-500",
    dot: "bg-cyan-500",
    detailText: "text-cyan-600",
  },
  pink: {
    text: "text-pink-700",
    bg: "bg-pink-50",
    solid: "bg-pink-500",
    dot: "bg-pink-500",
    detailText: "text-pink-600",
  },
  gray: {
    text: "text-gray-700",
    bg: "bg-gray-100",
    solid: "bg-gray-400",
    dot: "bg-gray-400",
    detailText: "text-gray-600",
  },
};

export const getSlideTypeColors = (
  slide: Slide,
  mediaKind?: "audio" | "video"
): SlideTypeColors => {
  switch ((slide.source_type || "").toUpperCase()) {
    case "VIDEO":
      // A "video" slide carrying an audio file is a listen, not a watch.
      return mediaKind === "audio" ? PALETTE.sky! : PALETTE.blue!;
    case "HTML_VIDEO":
      return PALETTE.blue!;
    case "AUDIO":
      return PALETTE.sky!;
    case "DOCUMENT":
      return PALETTE.amber!;
    case "QUESTION":
      return PALETTE.purple!;
    case "QUIZ":
    case "SCORM":
      return PALETTE.teal!;
    case "ASSIGNMENT":
      return PALETTE.emerald!;
    case "ASSESSMENT":
      return PALETTE.rose!;
    case "JUPYTER":
    case "CODE":
      return PALETTE.indigo!;
    case "PRESENTATION":
      return PALETTE.cyan!;
    case "FEEDBACK":
      return PALETTE.pink!;
    default:
      return PALETTE.gray!;
  }
};
