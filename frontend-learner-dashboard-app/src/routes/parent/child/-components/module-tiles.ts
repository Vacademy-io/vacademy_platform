import type { ParentIconKey } from "@/components/parent/ParentModuleIcon";

/** The six monitoring modules shown as tiles on the child home. */
export interface ModuleTile {
  /** settings/module key (matches PARENT_SETTING.parentPortal.modules + availableModules) */
  key: string;
  /** route segment under /parent/child/$childId/ */
  segment: string;
  /** i18n key under parent.tiles.* for the label */
  labelKey: string;
  icon: ParentIconKey;
  /** data-tour anchor id */
  tour: string;
}

export const MODULE_TILES: ModuleTile[] = [
  { key: "progress", segment: "progress", labelKey: "tiles.progress", icon: "progress", tour: "tile-progress" },
  { key: "attendance", segment: "attendance", labelKey: "tiles.attendance", icon: "attendance", tour: "tile-attendance" },
  { key: "assessments", segment: "assessments", labelKey: "tiles.assessments", icon: "assessments", tour: "tile-assessments" },
  { key: "liveSessions", segment: "live-classes", labelKey: "tiles.liveClasses", icon: "liveSessions", tour: "tile-live" },
  { key: "payments", segment: "payments", labelKey: "tiles.payments", icon: "payments", tour: "tile-payments" },
  { key: "badges", segment: "rewards", labelKey: "tiles.rewards", icon: "rewards", tour: "tile-rewards" },
];
