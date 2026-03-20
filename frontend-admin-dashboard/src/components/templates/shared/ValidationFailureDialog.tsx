import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, XCircle } from 'lucide-react';

interface ValidationFailureDialogProps {
    isOpen: boolean;
    onClose: () => void;
    missingVariables: string[];
    nullOrEmptyVariables: string[];
    availableVariables: Record<string, any>;
    errorMessage?: string;
}

export const ValidationFailureDialog: React.FC<ValidationFailureDialogProps> = ({
    isOpen,
    onClose,
    missingVariables,
    nullOrEmptyVariables,
    availableVariables,
    errorMessage
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-7xl max-h-[95vh] overflow-hidden sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] 2xl:max-w-7xl">
                <DialogHeader className="pb-4 sm:pb-6 px-4 sm:px-6">
                    <DialogTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl">
                        <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
                        <span className="break-words">Cannot Send Email</span>
                    </DialogTitle>
                    <DialogDescription className="text-sm sm:text-base mt-2 sm:mt-3 break-words">
                        The email template contains variables that cannot be resolved with the current context.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 sm:space-y-6 md:space-y-8 overflow-y-auto max-h-[calc(95vh-200px)] px-4 sm:px-6 pr-2 [&::-webkit-scrollbar]:hidden" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
                    {errorMessage && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                            <p className="text-xs sm:text-sm text-red-800 font-medium break-words">
                                {errorMessage}
                            </p>
                        </div>
                    )}

                    {missingVariables.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                            <p className="text-xs sm:text-sm text-red-800 font-medium mb-2 break-words">
                                The following variables are missing and cannot be resolved:
                            </p>
                            <div className="space-y-1">
                                {missingVariables.map((variable, index) => (
                                    <div key={index} className="text-xs sm:text-sm text-red-700 bg-red-100 px-2 py-1 rounded break-all">
                                        {variable}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {nullOrEmptyVariables.length > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
                            <p className="text-xs sm:text-sm text-orange-800 font-medium mb-2 break-words">
                                The following variables have null or empty values and cannot be used:
                            </p>
                            <div className="space-y-1">
                                {nullOrEmptyVariables.map((variable, index) => (
                                    <div key={index} className="text-xs sm:text-sm text-orange-700 bg-orange-100 px-2 py-1 rounded break-all">
                                        {variable}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-blue-800 break-words">
                            <strong>Solution:</strong> Edit your template to remove the missing variables or ensure the required data is available in the current context.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-4 sm:pt-6 border-t border-gray-200 px-4 sm:px-6 pb-4 sm:pb-6">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="text-xs sm:text-sm px-4 py-2"
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
