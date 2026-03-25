import {
    DripCondition,
    DripConditionRule,
    DripConditionRuleType,
    DripConditionBehavior,
    DripConditionLevel,
} from '@/types/course-settings';

/**
 * Generate a unique ID for drip conditions
 */
export const generateDripConditionId = (): string => {
    return `drip-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Format drip condition rule for display
 */
export const formatDripRule = (rule: DripConditionRule): string => {
    switch (rule.type) {
        case 'date_based': {
            const params = rule.params as { unlock_date: string };
            const date = new Date(params.unlock_date);
            return `Unlocks on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
        }
        case 'completion_based': {
            const compParams = rule.params as {
                metric: string;
                count?: number;
                threshold: number;
            };
            if (compParams.metric === 'average_of_last_n') {
                return `Average of last ${compParams.count} items ≥ ${compParams.threshold}%`;
            }
            return `Average of all items ≥ ${compParams.threshold}%`;
        }
        case 'prerequisite': {
            const preqParams = rule.params as {
                required_chapters?: string[];
                required_slides?: string[];
                threshold: number;
            };
            const items = preqParams.required_chapters || preqParams.required_slides || [];
            const type = preqParams.required_chapters ? 'chapters' : 'slides';
            return `${items.length} ${type} completed ≥ ${preqParams.threshold}%`;
        }
        case 'sequential': {
            const seqParams = rule.params as { threshold: number };
            return `Previous item completed ≥ ${seqParams.threshold}%`;
        }
        default:
            return 'Custom rule';
    }
};

/**
 * Format behavior for display
 */
export const formatBehavior = (behavior: DripConditionBehavior): string => {
    switch (behavior) {
        case 'lock':
            return 'Visible but Locked';
        case 'hide':
            return 'Hidden';
        case 'both':
            return 'Progressive Unlock';
        default:
            return behavior;
    }
};

/**
 * Get behavior icon
 */
export const getBehaviorIcon = (behavior: DripConditionBehavior): string => {
    switch (behavior) {
        case 'lock':
            return '🔒';
        case 'hide':
            return '👁️';
        case 'both':
            return '🔓';
        default:
            return '⚙️';
    }
};

/**
 * Get level display name
 */
export const getLevelDisplayName = (level: DripConditionLevel): string => {
    switch (level) {
        case 'package':
            return 'Package';
        case 'chapter':
            return 'Chapter';
        case 'slide':
            return 'Slide';
        default:
            return level;
    }
};

/**
 * Get level color for badges
 */
export const getLevelColor = (level: DripConditionLevel): string => {
    switch (level) {
        case 'package':
            return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'chapter':
            return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'slide':
            return 'bg-green-100 text-green-800 border-green-200';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

/**
 * Validate drip condition
 */
export const validateDripCondition = (
    condition: Partial<DripCondition>
): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!condition.level) {
        errors.push('Level is required');
    }

    if (!condition.level_id || condition.level_id.trim() === '') {
        errors.push('Level ID is required');
    }

    if (!condition.drip_condition || !Array.isArray(condition.drip_condition)) {
        errors.push('Drip condition configuration must be an array');
        return { valid: false, errors };
    }

    if (condition.drip_condition.length === 0) {
        errors.push('At least one drip condition configuration is required');
        return { valid: false, errors };
    }

    // Validate each config in the array
    condition.drip_condition.forEach((config, configIndex) => {
        const prefix = `Config ${configIndex + 1}:`;

        // Validate target is required
        if (!config.target) {
            errors.push(`${prefix} Target is required (chapter or slide)`);
        }

        // Validate behavior
        if (!config.behavior || !['lock', 'hide', 'both'].includes(config.behavior)) {
            errors.push(`${prefix} Valid behavior is required (lock, hide, or both)`);
        }

        // Validate rules
        if (!config.rules || config.rules.length === 0) {
            errors.push(`${prefix} At least one rule is required`);
        } else {
            config.rules.forEach((rule, index) => {
                const ruleErrors = validateRule(rule, index);
                errors.push(...ruleErrors.map((err) => `${prefix} ${err}`));
            });
        }
    });

    return { valid: errors.length === 0, errors };
};

/**
 * Validate individual rule
 */
const validateRule = (rule: DripConditionRule, index: number): string[] => {
    const errors: string[] = [];
    const prefix = `Rule ${index + 1}:`;

    if (!rule.type) {
        errors.push(`${prefix} Rule type is required`);
        return errors;
    }

    switch (rule.type) {
        case 'date_based': {
            const dateParams = rule.params as { unlock_date?: string };
            if (!dateParams.unlock_date) {
                errors.push(`${prefix} Unlock date is required`);
            } else {
                const date = new Date(dateParams.unlock_date);
                if (isNaN(date.getTime())) {
                    errors.push(`${prefix} Invalid date format`);
                }
            }
            break;
        }
        case 'completion_based': {
            const compParams = rule.params as {
                metric?: string;
                count?: number;
                threshold?: number;
            };
            if (!compParams.metric) {
                errors.push(`${prefix} Metric is required`);
            }
            if (
                compParams.metric === 'average_of_last_n' &&
                (!compParams.count || compParams.count < 1)
            ) {
                errors.push(`${prefix} Count must be greater than 0 for average_of_last_n`);
            }
            if (
                compParams.threshold === undefined ||
                compParams.threshold < 0 ||
                compParams.threshold > 100
            ) {
                errors.push(`${prefix} Threshold must be between 0 and 100`);
            }
            break;
        }
        case 'prerequisite': {
            const preqParams = rule.params as {
                required_chapters?: string[];
                required_slides?: string[];
                threshold?: number;
            };
            if (!preqParams.required_chapters && !preqParams.required_slides) {
                errors.push(`${prefix} Required chapters or slides must be specified`);
            }
            if (
                (preqParams.required_chapters && preqParams.required_chapters.length === 0) ||
                (preqParams.required_slides && preqParams.required_slides.length === 0)
            ) {
                errors.push(`${prefix} At least one required item must be specified`);
            }
            if (
                preqParams.threshold === undefined ||
                preqParams.threshold < 0 ||
                preqParams.threshold > 100
            ) {
                errors.push(`${prefix} Threshold must be between 0 and 100`);
            }
            break;
        }
        case 'sequential': {
            const seqParams = rule.params as { threshold?: number };
            if (
                seqParams.threshold === undefined ||
                seqParams.threshold < 0 ||
                seqParams.threshold > 100
            ) {
                errors.push(`${prefix} Threshold must be between 0 and 100`);
            }
            break;
        }
    }

    return errors;
};

/**
 * Get rule type display name
 */
export const getRuleTypeDisplayName = (type: DripConditionRuleType): string => {
    switch (type) {
        case 'date_based':
            return 'Date-Based';
        case 'completion_based':
            return 'Completion-Based';
        case 'prerequisite':
            return 'Prerequisite';
        case 'sequential':
            return 'Sequential';
        default:
            return type;
    }
};

/**
 * Create default rule based on type
 */
export const createDefaultRule = (type: DripConditionRuleType): DripConditionRule => {
    switch (type) {
        case 'date_based':
            return {
                type: 'date_based',
                params: {
                    unlock_date: new Date().toISOString(),
                },
            };
        case 'completion_based':
            return {
                type: 'completion_based',
                params: {
                    metric: 'average_of_all',
                    threshold: 75,
                },
            };
        case 'prerequisite':
            return {
                type: 'prerequisite',
                params: {
                    required_chapters: [],
                    threshold: 100,
                },
            };
        case 'sequential':
            return {
                type: 'sequential',
                params: {
                    requires_previous: true,
                    threshold: 100,
                },
            };
    }
};

/**
 * Create empty drip condition
 */
export const createEmptyDripCondition = (): Partial<DripCondition> => {
    return {
        id: generateDripConditionId(),
        level: 'chapter',
        level_id: '',
        drip_condition: [
            {
                target: 'chapter',
                behavior: 'lock',
                is_enabled: true,
                rules: [],
            },
        ],
        enabled: true,
        created_at: new Date().toISOString(),
    };
};
