/**
 * Drip Conditions Types
 *
 * This file contains all TypeScript types and interfaces used in the drip conditions feature.
 * Drip conditions allow content to be progressively unlocked based on various criteria.
 *
 * @module types/drip-conditions
 */

// ============================================================================
// Level and Behavior Types
// ============================================================================

/**
 * The hierarchical level at which a drip condition is applied
 *
 * - `package`: Course-level conditions that can target chapters or slides
 * - `chapter`: Chapter-level conditions that affect access to that chapter
 * - `slide`: Slide-level conditions that affect access to that slide
 */
export type DripConditionLevel = "package" | "chapter" | "slide";

/**
 * How locked content should behave when conditions are not met
 *
 * - `lock`: Content is visible but not accessible (shows lock icon)
 * - `hide`: Content is completely hidden from the learner
 * - `both`: Progressive unlock - hidden first, then locked, then unlocked
 */
export type DripConditionBehavior = "lock" | "hide" | "both";

/**
 * Target type for package-level conditions (only applicable at package level)
 *
 * - `chapter`: Package condition applies to all chapters
 * - `slide`: Package condition applies to all slides
 */
export type DripConditionTarget = "chapter" | "slide";

// ============================================================================
// Rule Types
// ============================================================================

/**
 * Types of rules that can be used to control content unlocking
 *
 * - `date_based`: Unlock content at a specific date and time
 * - `completion_based`: Unlock based on performance metrics (average scores)
 * - `prerequisite`: Unlock after completing specific chapters/slides
 * - `sequential`: Unlock after completing the previous item in sequence
 */
export type DripConditionRuleType =
  | "date_based"
  | "completion_based"
  | "prerequisite"
  | "sequential";

/**
 * Metric types for completion-based rules
 *
 * - `average_of_all`: Calculate average from all completed items
 * - `average_of_last_n`: Calculate average from the last N completed items
 */
export type DripConditionMetric = "average_of_last_n" | "average_of_all";

// ============================================================================
// Rule Parameter Interfaces
// ============================================================================

/**
 * Parameters for date-based unlock rules
 * Content unlocks automatically at the specified date and time
 */
export interface DateBasedParams {
  /** ISO 8601 formatted date-time string (e.g., "2024-01-15T10:00:00Z") */
  unlock_date: string;
}

/**
 * Parameters for completion-based unlock rules
 * Content unlocks when performance metrics meet the threshold
 */
export interface CompletionBasedParams {
  /** The metric to calculate (average of all items or last N items) */
  metric: DripConditionMetric;

  /**
   * Number of recent items to consider (required when metric is 'average_of_last_n')
   * Must be greater than 0
   */
  count?: number;

  /**
   * Minimum percentage required to unlock (0-100)
   * e.g., 75 means 75% average score required
   */
  threshold: number;
}

/**
 * Parameters for prerequisite unlock rules
 * Content unlocks after completing specified chapters or slides
 */
export interface PrerequisiteParams {
  /** Array of chapter IDs that must be completed (for chapter-level conditions) */
  required_chapters?: string[];

  /** Array of slide IDs that must be completed (for slide-level conditions) */
  required_slides?: string[];

  /**
   * Minimum completion percentage required for prerequisites (0-100)
   * e.g., 100 means all prerequisites must be fully completed
   */
  threshold: number;
}

/**
 * Parameters for sequential unlock rules
 * Content unlocks after completing the previous item in the sequence
 */
export interface SequentialParams {
  /**
   * Whether the previous item must be completed
   * Typically true for sequential progression
   */
  requires_previous: boolean;

  /**
   * Minimum completion percentage required for the previous item (0-100)
   * e.g., 80 means previous item must be 80% complete
   */
  threshold: number;
}

/**
 * Union type of all possible rule parameter types
 * Used for type-safe handling of different rule parameter structures
 */
export type DripConditionRuleParams =
  | DateBasedParams
  | CompletionBasedParams
  | PrerequisiteParams
  | SequentialParams;

// ============================================================================
// Rule and Condition Interfaces
// ============================================================================

/**
 * A single drip condition rule
 * Multiple rules can be combined within a single condition
 */
export interface DripConditionRule {
  /** The type of rule determining how content unlocks */
  type: DripConditionRuleType;

  /** Rule-specific parameters (type varies based on rule type) */
  params: DripConditionRuleParams;
}

/**
 * The JSON structure that defines how and when content unlocks
 * Contains behavior settings and one or more rules
 */
export interface DripConditionJson {
  /**
   * Target type for package-level conditions only
   * Specifies whether the condition applies to chapters or slides
   * Must be undefined for chapter and slide level conditions
   */
  target?: DripConditionTarget;

  /** How locked content should appear/behave */
  behavior: DripConditionBehavior;

  /**
   * Whether this specific condition is enabled
   * If false, this condition is skipped during evaluation
   */
  is_enabled?: boolean;

  /**
   * Array of rules that control unlocking
   * Current implementation typically uses a single rule per condition
   */
  rules: DripConditionRule[];
}

/**
 * Complete drip condition entity
 * Represents a single drip condition configuration with metadata
 */
export interface DripCondition {
  /** Unique identifier for this drip condition (generated client-side) */
  id: string;

  /** The hierarchical level where this condition is applied */
  level: DripConditionLevel;

  /**
   * ID of the entity this condition is attached to
   * - For package level: package/course ID
   * - For chapter level: chapter ID
   * - For slide level: slide ID
   */
  level_id: string;

  /** The actual condition configuration (behavior and rules) */
  drip_condition: DripConditionJson;

  /** Whether this condition is currently active */
  enabled: boolean;

  /** ISO timestamp when the condition was created */
  created_at?: string;

  /** ISO timestamp when the condition was last updated */
  updated_at?: string;
}

// ============================================================================
// Settings and Global Configuration
// ============================================================================

/**
 * Global drip conditions settings for a course
 * Includes the master toggle and all conditions for the course
 */
export interface DripConditionsSettings {
  /**
   * Master toggle for drip functionality
   * When false, all drip conditions are ignored regardless of individual settings
   */
  enabled: boolean;

  /**
   * Array of all drip conditions for the course
   * Includes package, chapter, and slide level conditions
   */
  conditions: DripCondition[];
}

// ============================================================================
// Validation and Error Types
// ============================================================================

/**
 * Result of validating a drip condition
 * Contains validation status and any error messages
 */
export interface DripConditionValidationResult {
  /** Whether the condition passed all validation checks */
  valid: boolean;

  /** Array of human-readable error messages (empty if valid) */
  errors: string[];
}

// ============================================================================
// UI Component Props Types
// ============================================================================

/**
 * Props for the Package Drip Condition Dialog component
 */
export interface PackageDripConditionDialogProps {
  /** Whether the dialog is visible */
  open: boolean;

  /** Callback when dialog should close */
  onClose: () => void;

  /** Callback when condition is saved */
  onSave: (condition: DripCondition) => void;

  /** ID of the package/course being configured */
  packageId: string;

  /** Display name of the package/course */
  packageName: string;

  /** Existing condition to edit (undefined for creating new) */
  condition?: DripCondition;
}

/**
 * Props for the Chapter Drip Condition Dialog component
 */
export interface ChapterDripConditionDialogProps {
  /** Whether the dialog is visible */
  open: boolean;

  /** Callback when dialog should close */
  onClose: () => void;

  /** ID of the chapter being configured */
  chapterId: string | null;

  /** Display name of the chapter */
  chapterName: string | null;

  /** ID of the parent package/course */
  packageId: string | null;

  /** All drip conditions for the course (to check for conflicts) */
  dripConditions: DripCondition[];

  /** Callback when conditions are saved */
  onSave: (updatedConditions: DripCondition[]) => Promise<void>;

  /** Array of all chapters for prerequisite selection */
  allChapters?: Array<{ id: string; name: string }>;
}

/**
 * Props for the Slide Drip Condition Dialog component
 */
export interface SlideDripConditionDialogProps {
  /** Whether the dialog is visible */
  open: boolean;

  /** Callback when dialog should close */
  onClose: () => void;

  /** ID of the slide being configured */
  slideId: string | null;

  /** Display name of the slide */
  slideName: string | null;

  /** ID of the parent package/course */
  packageId: string | null;

  /** All drip conditions for the course (to check for conflicts) */
  dripConditions: DripCondition[];

  /** Callback when conditions are saved */
  onSave: (updatedConditions: DripCondition[]) => Promise<void>;

  /** Array of all slides for prerequisite selection */
  allSlides?: Array<{ id: string; heading: string }>;
}

/**
 * Props for the Condition Form component (internal form component)
 */
export interface ConditionFormProps {
  /** Existing condition to edit (undefined for creating new) */
  condition?: DripCondition;

  /** ID of the chapter or slide being configured */
  chapterId?: string;
  slideId?: string;

  /** Callback when form is saved */
  onSave: (condition: Omit<DripCondition, "id">) => void;

  /** Whether the form is currently saving */
  saving: boolean;

  /** Options for prerequisite selection (chapters or slides) */
  allChapters?: Array<{ id: string; name: string }>;
  allSlides?: Array<{ id: string; heading: string }>;
}

// ============================================================================
// Utility and Helper Types
// ============================================================================

/**
 * Display information for a drip condition level
 */
export interface DripLevelDisplay {
  /** Display name (e.g., "Package", "Chapter", "Slide") */
  name: string;

  /** CSS color classes for badges */
  colorClass: string;

  /** Icon or emoji representation */
  icon: string;
}

/**
 * Display information for a behavior type
 */
export interface DripBehaviorDisplay {
  /** Display name (e.g., "Visible but Locked", "Hidden") */
  name: string;

  /** Icon or emoji representation */
  icon: string;

  /** Short description of the behavior */
  description: string;
}

/**
 * Display information for a rule type
 */
export interface DripRuleTypeDisplay {
  /** Display name (e.g., "Date-Based", "Completion-Based") */
  name: string;

  /** Icon representation */
  icon: string;

  /** Short description of what the rule does */
  description: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if params are DateBasedParams
 */
export function isDateBasedParams(
  params: DripConditionRuleParams
): params is DateBasedParams {
  return "unlock_date" in params;
}

/**
 * Type guard to check if params are CompletionBasedParams
 */
export function isCompletionBasedParams(
  params: DripConditionRuleParams
): params is CompletionBasedParams {
  return "metric" in params && "threshold" in params;
}

/**
 * Type guard to check if params are PrerequisiteParams
 */
export function isPrerequisiteParams(
  params: DripConditionRuleParams
): params is PrerequisiteParams {
  return (
    ("required_chapters" in params || "required_slides" in params) &&
    "threshold" in params
  );
}

/**
 * Type guard to check if params are SequentialParams
 */
export function isSequentialParams(
  params: DripConditionRuleParams
): params is SequentialParams {
  return "requires_previous" in params && "threshold" in params;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Available rule types for package-level conditions
 * Package level only supports date-based and completion-based rules
 */
export const PACKAGE_RULE_TYPES: readonly DripConditionRuleType[] = [
  "date_based",
  "completion_based",
] as const;

/**
 * Available rule types for chapter and slide level conditions
 * Chapter and slide levels support all rule types
 */
export const CONTENT_RULE_TYPES: readonly DripConditionRuleType[] = [
  "date_based",
  "completion_based",
  "prerequisite",
  "sequential",
] as const;

/**
 * All available behavior types
 */
export const BEHAVIOR_TYPES: readonly DripConditionBehavior[] = [
  "lock",
  "hide",
  "both",
] as const;

/**
 * All available level types
 */
export const LEVEL_TYPES: readonly DripConditionLevel[] = [
  "package",
  "chapter",
  "slide",
] as const;

/**
 * Default threshold percentage for completion-based rules
 */
export const DEFAULT_COMPLETION_THRESHOLD = 75;

/**
 * Default threshold percentage for prerequisite rules
 */
export const DEFAULT_PREREQUISITE_THRESHOLD = 100;

/**
 * Default threshold percentage for sequential rules
 */
export const DEFAULT_SEQUENTIAL_THRESHOLD = 100;
