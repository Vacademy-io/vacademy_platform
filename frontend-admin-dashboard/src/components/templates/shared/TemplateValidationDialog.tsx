import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ValidationResult } from '@/utils/template-validation';

interface TemplateValidationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    validationResult: ValidationResult | null;
    onRetry?: () => void;
    onProceedAnyway?: () => void;
    templateName?: string;
}

export const TemplateValidationDialog: React.FC<TemplateValidationDialogProps> = ({
    isOpen,
    onClose,
    validationResult,
    onRetry,
    onProceedAnyway,
    templateName = 'Template'
}) => {
    if (!validationResult) return null;

    const { isValid, canSend, missingVariables, warnings, availableVariables, errorMessage } = validationResult;

    const getStatusIcon = () => {
        if (isValid && canSend) {
            return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        } else if (missingVariables.length > 0) {
            return <XCircle className="h-5 w-5 text-red-500" />;
        } else if (warnings.length > 0) {
            return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
        }
        return <Info className="h-5 w-5 text-blue-500" />;
    };

    const getStatusMessage = () => {
        if (isValid && canSend) {
            return {
                title: 'Template Ready to Send',
                description: 'All required variables are available. You can proceed with sending the email.',
                variant: 'default' as const
            };
        } else if (missingVariables.length > 0) {
            return {
                title: 'Cannot Send Email',
                description: `The template "${templateName}" cannot be sent because ${missingVariables.length} required variable${missingVariables.length > 1 ? 's' : ''} ${missingVariables.length > 1 ? 'are' : 'is'} missing from the available data.`,
                variant: 'destructive' as const
            };
        } else if (warnings.length > 0) {
            return {
                title: 'Template Warnings',
                description: 'The template has some warnings but can still be sent.',
                variant: 'default' as const
            };
        }
        return {
            title: 'Template Validation',
            description: 'Please review the template validation results.',
            variant: 'default' as const
        };
    };

    const status = getStatusMessage();

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-7xl max-h-[95vh] overflow-hidden sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] 2xl:max-w-7xl">
                <DialogHeader className="pb-4 sm:pb-6 px-4 sm:px-6">
                    <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl">
                        <div className="scale-75 sm:scale-100">
                            {getStatusIcon()}
                        </div>
                        <span className="break-words">{status.title}</span>
                    </DialogTitle>
                    <DialogDescription className="text-sm sm:text-base mt-2 sm:mt-3 break-words">
                        {status.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 sm:space-y-6 md:space-y-8 overflow-y-auto max-h-[calc(95vh-200px)] px-4 sm:px-6 pr-2 [&::-webkit-scrollbar]:hidden" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
                    {/* Error Message */}
                    {errorMessage && (
                        <Alert variant="destructive" className="p-3 sm:p-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-xs sm:text-sm break-words">{errorMessage}</AlertDescription>
                        </Alert>
                    )}

                    {/* Missing Variables */}
                    {missingVariables.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs sm:text-sm font-medium text-red-600 flex items-center gap-2">
                                <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                                Missing Variables ({missingVariables.length})
                            </h4>
                            <div className="flex flex-wrap gap-1 sm:gap-2">
                                {missingVariables.map((variable) => (
                                    <Badge key={variable} variant="destructive" className="text-xs break-all">
                                        {variable}
                                    </Badge>
                                ))}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground break-words">
                                These variables are not available in the current context. Please either:
                                <br />
                                • Remove them from the template, or
                                <br />
                                • Ensure the required data is available
                            </p>
                        </div>
                    )}

                    {/* Warnings */}
                    {warnings.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs sm:text-sm font-medium text-yellow-600 flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
                                Warnings ({warnings.length})
                            </h4>
                            <div className="space-y-1">
                                {warnings.map((warning, index) => (
                                    <p key={index} className="text-xs sm:text-sm text-muted-foreground break-words">
                                        • {warning}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Not Available Variables */}
                    {(() => {
                        const notAvailableVariables = Object.entries(availableVariables).filter(([variable, value]) =>
                            value === null || value === undefined || value === '' || value === 'Not Available'
                        );

                        if (notAvailableVariables.length > 0) {
                            return (
                                <div className="space-y-4 sm:space-y-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                        <div className="flex items-center gap-2 sm:gap-3">
                                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
                                            <h4 className="text-sm sm:text-base md:text-lg font-semibold text-red-700">
                                                Not Available Variables
                                            </h4>
                                        </div>
                                        <span className="px-2 sm:px-3 py-1 bg-red-100 text-red-700 text-xs sm:text-sm font-medium rounded-full w-fit">
                                            {notAvailableVariables.length}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                                        {notAvailableVariables.map(([variable, value]) => (
                                            <div key={variable} className="group p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-150 transition-all duration-200 hover:border-red-300 hover:shadow-md">
                                                <div className="font-mono font-semibold text-xs sm:text-sm text-red-800 mb-1 sm:mb-2 break-all">
                                                    {variable}
                                                </div>
                                                <div className="flex items-center gap-1 sm:gap-2 text-red-600 text-xs sm:text-sm">
                                                    <span className="text-sm sm:text-lg">❌</span>
                                                    <span className="font-medium">Not Available</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}


                    {/* Success Message */}
                    {isValid && canSend && (
                        <Alert className="p-3 sm:p-4">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription className="text-xs sm:text-sm break-words">
                                All template variables are resolved successfully. The email can be sent to all recipients.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6 border-t border-gray-200 px-4 sm:px-6 pb-4 sm:pb-6">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="w-full sm:w-auto text-xs sm:text-sm px-4 py-2 order-2 sm:order-1"
                    >
                        {isValid && canSend ? 'Close' : 'Cancel'}
                    </Button>

                    {onRetry && !isValid && (
                        <Button
                            variant="outline"
                            onClick={onRetry}
                            className="w-full sm:w-auto text-xs sm:text-sm px-4 py-2 order-1 sm:order-2"
                        >
                            Retry Validation
                        </Button>
                    )}

                    {onProceedAnyway && !canSend && (
                        <Button
                            variant="destructive"
                            onClick={onProceedAnyway}
                            disabled={missingVariables.length > 0}
                            className="w-full sm:w-auto text-xs sm:text-sm px-4 py-2 order-1 sm:order-3"
                        >
                            Send Anyway
                        </Button>
                    )}

                    {isValid && canSend && (
                        <Button
                            onClick={onClose}
                            className="w-full sm:w-auto text-xs sm:text-sm px-4 py-2 order-1 sm:order-2"
                        >
                            Continue Sending
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
