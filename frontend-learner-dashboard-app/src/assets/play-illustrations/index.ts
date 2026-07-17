/**
 * Play theme illustrations from unDraw (undraw.co)
 *
 * These SVGs use `currentColor` for their accent color.
 * Control the accent by setting CSS `color` on the component or parent.
 *
 * Usage:
 *   <playIllustrations.Winners className="text-orange-300 h-40" />
 *
 * Trimmed 2026-07-16: 15 exports with zero consumers were deleted along
 * with their .svg files (the Dashboard reskin replaced them with the
 * felted-clay webp set in src/assets/cleaner-play/). Re-add from undraw.co
 * if a new surface needs one.
 */

import Winners from "./winners.svg";
import Treasure from "./treasure.svg";
import OnlineLearning from "./online-learning.svg";
import Completed from "./completed.svg";
import BookLover from "./book-lover.svg";
import Learning from "./learning.svg";
import FeelingHappy from "./feeling-happy.svg";

export const playIllustrations = {
  Winners,
  Treasure,
  OnlineLearning,
  Completed,
  BookLover,
  Learning,
  FeelingHappy,
} as const;
