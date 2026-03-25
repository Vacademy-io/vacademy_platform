/**
 * Template Validation Utilities
 *
 * This module provides validation functions for template variables
 * before sending emails or WhatsApp messages.
 */

import { templateVariableResolver, VariableResolutionResult } from '@/services/template-variable-resolver';
import { PageContext } from '@/services/page-context-resolver';

export interface ValidationResult {
    isValid: boolean;
    canSend: boolean;
    missingVariables: string[];
    nullOrEmptyVariables: string[];
    warnings: string[];
    availableVariables: Record<string, string>;
    errorMessage?: string;
}

export interface ValidationContext {
    studentId?: string;
    courseId?: string;
    batchId?: string;
    instituteId?: string;
    pageContext?: PageContext;
}

/**
 * Validate template content and resolve all variables
 */
export async function validateTemplateVariables(
    templateContent: string,
    context?: ValidationContext
): Promise<ValidationResult> {
    try {
        const resolutionResult = await templateVariableResolver.resolveTemplateVariables(
            templateContent,
            context
        );

        const isValid = resolutionResult.success;
        const missingVariables = resolutionResult.missingVariables;
        const warnings = resolutionResult.warnings;
        const availableVariables = resolutionResult.availableVariables;

        // Check for null/empty values in resolved variables
        const nullOrEmptyVariables: string[] = [];
        Object.entries(availableVariables).forEach(([variable, value]) => {
            if (value === null || value === undefined || value === '' || value === 'Not Available') {
                nullOrEmptyVariables.push(variable);
            }
        });

        // Template is invalid if there are missing variables OR null/empty values
        const hasNullOrEmptyValues = nullOrEmptyVariables.length > 0;
        const canSend = isValid && !hasNullOrEmptyValues;

        let errorMessage: string | undefined;

        if (!isValid) {
            errorMessage = generateMissingVariablesMessage(missingVariables);
        } else if (hasNullOrEmptyValues) {
            errorMessage = `Template cannot be sent because some variables have null or empty values: ${nullOrEmptyVariables.join(', ')}`;
        }

        const result: ValidationResult = {
            isValid,
            canSend,
            missingVariables,
            nullOrEmptyVariables,
            warnings,
            availableVariables,
            errorMessage
        };

        return result;

    } catch (error) {

        return {
            isValid: false,
            canSend: false,
            missingVariables: [],
            nullOrEmptyVariables: [],
            warnings: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
            availableVariables: {},
            errorMessage: 'Failed to validate template variables. Please try again.'
        };
    }
}

/**
 * Generate a user-friendly message for missing variables
 */
function generateMissingVariablesMessage(missingVariables: string[]): string {
    if (missingVariables.length === 0) {
        return '';
    }

    if (missingVariables.length === 1) {
        return `The following variable is missing and cannot be resolved: ${missingVariables[0]}`;
    }

    if (missingVariables.length <= 5) {
        return `The following variables are missing and cannot be resolved: ${missingVariables.join(', ')}`;
    }

    return `Multiple variables are missing (${missingVariables.length} total): ${missingVariables.slice(0, 3).join(', ')} and ${missingVariables.length - 3} more.`;
}

/**
 * Check if a template has any variables
 */
export function hasTemplateVariables(templateContent: string): boolean {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    return variableRegex.test(templateContent);
}

/**
 * Get a list of all variables in a template
 */
export function getTemplateVariables(templateContent: string): string[] {
    return templateVariableResolver.extractVariables(templateContent);
}

/**
 * Validate multiple templates at once
 */
export async function validateMultipleTemplates(
    templates: Array<{ content: string; context?: ValidationContext }>
): Promise<ValidationResult[]> {
    const validationPromises = templates.map(template =>
        validateTemplateVariables(template.content, template.context)
    );

    return Promise.all(validationPromises);
}

/**
 * Check if all templates in a batch are valid
 */
export async function validateTemplateBatch(
    templates: Array<{ content: string; context?: ValidationContext }>
): Promise<{
    allValid: boolean;
    results: ValidationResult[];
    totalMissing: number;
    totalWarnings: number;
}> {
    const results = await validateMultipleTemplates(templates);

    const allValid = results.every(result => result.isValid);
    const totalMissing = results.reduce((sum, result) => sum + result.missingVariables.length, 0);
    const totalWarnings = results.reduce((sum, result) => sum + result.warnings.length, 0);

    return {
        allValid,
        results,
        totalMissing,
        totalWarnings
    };
}

/**
 * Generate a comprehensive validation report
 */
export function generateValidationReport(results: ValidationResult[]): {
    summary: string;
    details: Array<{
        templateIndex: number;
        isValid: boolean;
        missingVariables: string[];
        warnings: string[];
    }>;
} {
    const validCount = results.filter(r => r.isValid).length;
    const totalCount = results.length;
    const totalMissing = results.reduce((sum, r) => sum + r.missingVariables.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

    let summary = `Validation Summary: ${validCount}/${totalCount} templates are valid`;

    if (totalMissing > 0) {
        summary += `, ${totalMissing} missing variables`;
    }

    if (totalWarnings > 0) {
        summary += `, ${totalWarnings} warnings`;
    }

    const details = results.map((result, index) => ({
        templateIndex: index,
        isValid: result.isValid,
        missingVariables: result.missingVariables,
        warnings: result.warnings
    }));

    return { summary, details };
}
