/**
 * Template Validation Warning Component
 *
 * Displays warnings for missing template variables
 */

import React from 'react';
import { AlertTriangle, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface TemplateValidationWarningProps {
    isValid: boolean;
    missingVariables: string[];
    warnings: string[];
    errorMessage?: string;
    onDismiss?: () => void;
    onRetry?: () => void;
    className?: string;
}

export const TemplateValidationWarning: React.FC<TemplateValidationWarningProps> = ({
    isValid,
    missingVariables,
    warnings,
    errorMessage,
    onDismiss,
    onRetry,
    className = ''
}) => {
    if (isValid && warnings.length === 0) {
        return (
            <Alert className={`border-green-200 bg-green-50 text-green-800 ${className}`}>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                    All template variables are resolved successfully. Ready to send!
                </AlertDescription>
            </Alert>
        );
    }

    if (missingVariables.length > 0) {
        return (
            <Alert className={`border-red-200 bg-red-50 text-red-800 ${className}`}>
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                    <div className="space-y-2">
                        <div className="font-medium">
                            Cannot send: {missingVariables.length} variable{missingVariables.length > 1 ? 's' : ''} missing
                        </div>
                        <div className="text-sm">
                            <strong>Missing variables:</strong> {missingVariables.join(', ')}
                        </div>
                        <div className="text-xs text-red-600">
                            Please ensure all required data is available or remove these variables from the template.
                        </div>
                        {onRetry && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={onRetry}
                                className="mt-2"
                            >
                                Retry Validation
                            </Button>
                        )}
                    </div>
                </AlertDescription>
                {onDismiss && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onDismiss}
                        className="absolute right-2 top-2 h-6 w-6 p-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </Alert>
        );
    }

    if (warnings.length > 0) {
        return (
            <Alert className={`border-yellow-200 bg-yellow-50 text-yellow-800 ${className}`}>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription>
                    <div className="space-y-2">
                        <div className="font-medium">
                            Warning: {warnings.length} issue{warnings.length > 1 ? 's' : ''} detected
                        </div>
                        <div className="text-sm space-y-1">
                            {warnings.map((warning, index) => (
                                <div key={index} className="text-xs">
                                    • {warning}
                                </div>
                            ))}
                        </div>
                        <div className="text-xs text-yellow-600">
                            You can still send, but some variables may not be properly resolved.
                        </div>
                    </div>
                </AlertDescription>
                {onDismiss && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onDismiss}
                        className="absolute right-2 top-2 h-6 w-6 p-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </Alert>
        );
    }

    if (errorMessage) {
        return (
            <Alert className={`border-red-200 bg-red-50 text-red-800 ${className}`}>
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                    <div className="space-y-2">
                        <div className="font-medium">Validation Error</div>
                        <div className="text-sm">{errorMessage}</div>
                        {onRetry && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={onRetry}
                                className="mt-2"
                            >
                                Retry Validation
                            </Button>
                        )}
                    </div>
                </AlertDescription>
                {onDismiss && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onDismiss}
                        className="absolute right-2 top-2 h-6 w-6 p-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </Alert>
        );
    }

    return null;
};
