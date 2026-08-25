import type {
  DripConditionJson,
  DripConditionLevel,
  DripConditionTarget,
} from "./types";

/**
 * One stored drip condition as the admin dashboard writes it into the
 * institute's COURSE_SETTING blob.
 *
 * `drip_condition` is an array there (one config per targeted level), while a
 * `DripConditionJson` read off a chapter/slide row is a single object. Both
 * shapes flow through here.
 */
export interface StoredDripCondition {
  id: string;
  level: DripConditionLevel;
  level_id: string;
  drip_condition: DripConditionJson | DripConditionJson[];
  enabled?: boolean;
}

export interface ResolvedDripConditions {
  /** Institute-wide master switch (COURSE_SETTING.data.dripConditions.enabled) */
  enabled: boolean;
  /**
   * Explicit opt-in to enforce conditions stored in the settings blob.
   *
   * MUST default to false. Those conditions were written by the admin
   * dashboard for a long time while nothing read them, so institutes are
   * carrying rules that have never once locked anything — 83 of them across
   * 10 institutes as of Aug 2026, nearly all `lock` or `hide`. Honouring them
   * automatically would take content away from learners who have had it open
   * for months. An admin has to turn this on per institute.
   */
  applyConfiguredRules: boolean;
  conditions: StoredDripCondition[];
}

const EMPTY: ResolvedDripConditions = {
  enabled: false,
  applyConfiguredRules: false,
  conditions: [],
};

/**
 * Pull the drip configuration out of the raw institute-settings JSON.
 *
 * Conditions live in the institute settings rather than on the content rows:
 * that is where the admin dashboard writes them, so it is the only place a
 * learner can read back what an admin actually configured. Per-row
 * `drip_condition_json` is still honoured by callers as a fallback for
 * anything written before this path existed.
 */
export function parseCourseSettingsDripConditions(
  rawSettingsJson: string | null | undefined
): ResolvedDripConditions {
  if (!rawSettingsJson || rawSettingsJson.trim() === "") return EMPTY;

  try {
    const parsed = JSON.parse(rawSettingsJson);
    // Two shapes are in circulation for the cached settings blob: some writers
    // store the whole institute payload ({ setting: { COURSE_SETTING } }),
    // others store just the `setting` value ({ COURSE_SETTING }). Accept both
    // — reading the wrong one silently reports "no drip configured".
    const courseSetting =
      parsed?.setting?.COURSE_SETTING ?? parsed?.COURSE_SETTING ?? null;
    const drip = courseSetting?.data?.dripConditions ?? null;
    if (!drip || typeof drip !== "object") return EMPTY;

    return {
      enabled: drip.enabled === true,
      // `=== true` and not `!== false`: absent means "never opted in".
      applyConfiguredRules: drip.applyConfiguredRules === true,
      conditions: Array.isArray(drip.conditions) ? drip.conditions : [],
    };
  } catch (error) {
    console.error("Error parsing course drip conditions:", error);
    return EMPTY;
  }
}

const configsOf = (
  condition: StoredDripCondition
): DripConditionJson[] => {
  const raw = condition.drip_condition;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
};

const isLive = (config: DripConditionJson): boolean =>
  config.is_enabled !== false &&
  Array.isArray(config.rules) &&
  config.rules.length > 0;

/**
 * The condition that governs one piece of content.
 *
 * An item's own condition wins; otherwise the course-wide condition applies,
 * but only the part of it that targets this level — a package rule set to drip
 * chapters must leave subjects and slides alone.
 */
export function resolveDripCondition(
  conditions: StoredDripCondition[] | null | undefined,
  target: {
    level: Exclude<DripConditionLevel, "package">;
    levelId: string | null | undefined;
    packageId: string | null | undefined;
  }
): DripConditionJson | null {
  if (!conditions?.length) return null;
  const { level, levelId, packageId } = target;

  if (levelId) {
    const own = conditions
      .filter(
        (c) => c.level === level && c.level_id === levelId && c.enabled !== false
      )
      .flatMap(configsOf)
      .find(isLive);
    if (own) return own;
  }

  if (packageId) {
    const fromPackage = conditions
      .filter(
        (c) =>
          c.level === "package" &&
          c.level_id === packageId &&
          c.enabled !== false
      )
      .flatMap(configsOf)
      .find(
        (config) =>
          isLive(config) && config.target === (level as DripConditionTarget)
      );
    if (fromPackage) return fromPackage;
  }

  return null;
}
