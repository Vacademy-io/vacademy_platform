/**
 * Play theme illustrations from unDraw (undraw.co)
 * Import from this barrel file: import { illustrations } from "@/assets/play-illustrations"
 */

import goals from "./goals.svg";
import accomplishments from "./accomplishments.svg";
import winners from "./winners.svg";
import certificate from "./certificate.svg";
import treasure from "./treasure.svg";
import celebration from "./celebration.svg";
import onlineLearning from "./online-learning.svg";
import education from "./education.svg";
import continuousLearning from "./continuous-learning.svg";
import steppingUp from "./stepping-up.svg";
import successful from "./successful.svg";
import completed from "./completed.svg";
import progressOverview from "./progress-overview.svg";
import bookLover from "./book-lover.svg";
import learning from "./learning.svg";

export const playIllustrations = {
  /** Streak widget — motivation/empty state */
  goals,
  /** XP/level-up celebration */
  accomplishments,
  /** Achievement badges header */
  winners,
  /** Badge unlock reward */
  certificate,
  /** XP/reward earned */
  treasure,
  /** Badge unlocked modal / celebration */
  celebration,
  /** Continue learning card */
  onlineLearning,
  /** Empty course list state */
  education,
  /** Streak motivation — active streak */
  continuousLearning,
  /** Level-up toast */
  steppingUp,
  /** Course completion */
  successful,
  /** Course completed state */
  completed,
  /** Dashboard progress section */
  progressOverview,
  /** Reading/library section */
  bookLover,
  /** General learning */
  learning,
} as const;
