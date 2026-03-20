import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { TEMPLATE_VARIABLES } from '@/types/message-template-types';

interface VariablesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onVariableSelect: (variable: string) => void;
}

export const VariablesDialog: React.FC<VariablesDialogProps> = ({ open, onOpenChange, onVariableSelect }) => {
    // Filtered list of allowed variables
    const ALLOWED_VARIABLES = ['username', 'name', 'mobile_number', 'email'];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Insert Variable</DialogTitle>
                    <DialogDescription>
                        Click a variable to insert it into your template.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 mt-4">
                    {ALLOWED_VARIABLES.map((variable) => (
                        <button
                            key={variable}
                            className="flex items-center justify-start px-3 py-2 bg-secondary/50 hover:bg-secondary rounded-md text-sm border border-transparent hover:border-border transition-colors text-left"
                            onClick={() => {
                                onVariableSelect(`{{${variable}}}`);
                                onOpenChange(false);
                            }}
                            title="Click to insert"
                        >
                            <code className="text-primary font-semibold">{`{{${variable}}}`}</code>
                        </button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
};
