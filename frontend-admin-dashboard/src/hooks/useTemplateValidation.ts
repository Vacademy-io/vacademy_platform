/**
 * Template Validation Hook
 *
 * React hook for validating template variables before sending
 */

import { useState, useCallback } from 'react';
import { validateTemplateVariables, ValidationResult, ValidationContext } from '@/utils/template-validation';

export interface UseTemplateValidationOptions {
    onValidationComplete?: (result: ValidationResult) => void;
    onValidationError?: (error: Error) => void;
}

export interface UseTemplateValidationReturn {
    isValidating: boolean;
    validationResult: ValidationResult | null;
    validateTemplate: (content: string, context?: ValidationContext) => Promise<ValidationResult>;
    clearValidation: () => void;
    canSend: boolean;
    missingVariables: string[];
    warnings: string[];
    errorMessage?: string;
}

/**
 * Hook for template validation
 */
export function useTemplateValidation(
    options: UseTemplateValidationOptions = {}
): UseTemplateValidationReturn {
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

    const validateTemplate = useCallback(async (
        content: string,
        context?: ValidationContext
    ): Promise<ValidationResult> => {
        setIsValidating(true);

        try {
            const result = await validateTemplateVariables(content, context);
            setValidationResult(result);

            if (options.onValidationComplete) {
                options.onValidationComplete(result);
            }

            return result;
        } catch (error) {
            const errorResult: ValidationResult = {
                isValid: false,
                canSend: false,
                missingVariables: [],
                nullOrEmptyVariables: [],
                warnings: [],
                availableVariables: {},
                errorMessage: error instanceof Error ? error.message : 'Validation failed'
            };

            setValidationResult(errorResult);

            if (options.onValidationError) {
                options.onValidationError(error instanceof Error ? error : new Error('Validation failed'));
            }

            return errorResult;
        } finally {
            setIsValidating(false);
        }
    }, [options]);

    const clearValidation = useCallback(() => {
        setValidationResult(null);
    }, []);

    return {
        isValidating,
        validationResult,
        validateTemplate,
        clearValidation,
        canSend: validationResult?.canSend ?? false,
        missingVariables: validationResult?.missingVariables ?? [],
        warnings: validationResult?.warnings ?? [],
        errorMessage: validationResult?.errorMessage
    };
}
