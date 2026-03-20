import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTrigger,
    DialogClose,
} from '@/components/ui/dialog';
import { DialogDescription, DialogTitle } from '@radix-ui/react-dialog';
import React, { ReactNode } from 'react';
import { X } from '@phosphor-icons/react';

interface DialogProps {
    trigger?: ReactNode;
    heading: string;
    content?: React.ReactNode;
    dialogWidth?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
    footer?: JSX.Element;
    isTour?: boolean;
    dialogId?: string;
    headerActions?: React.ReactNode;
    className?: string;
}

export const MyDialog = ({
    trigger,
    heading,
    content,
    children,
    dialogWidth,
    open,
    onOpenChange,
    footer,
    isTour = false,
    dialogId,
    headerActions,
    className,
}: DialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent
                data-dialog-id={dialogId}
                className={`${dialogWidth || 'max-w-2xl'} dialog-no-close-icon flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl border-0 bg-white p-0 shadow-2xl ${className || ''}`}
                onInteractOutside={(e) => {
                    if (isTour) e.preventDefault();
                }}
            >
                {/* Header */}
                <div className="flex w-full shrink-0 items-center border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-6 py-4">
                    {/* Left side - Header Actions */}
                    <div className="flex shrink-0 items-center gap-2">
                        {headerActions || <div className="w-8" />}
                    </div>

                    {/* Center - Title */}
                    <div className="flex flex-1 justify-center">
                        <DialogTitle asChild>
                            <h2 className="truncate text-lg font-semibold text-gray-900">
                                {heading}
                            </h2>
                        </DialogTitle>
                    </div>

                    {/* Right side - Close Button */}
                    <div className="flex shrink-0 items-center">
                        <DialogClose asChild>
                            <button
                                type="button"
                                className="flex size-8 items-center justify-center rounded-lg text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
                                aria-label="Close dialog"
                            >
                                <X size={18} weight="bold" />
                            </button>
                        </DialogClose>
                    </div>
                </div>

                {/* Content */}
                <DialogDescription asChild>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                        <div className="p-6">{children || content}</div>
                    </div>
                </DialogDescription>

                {/* Footer */}
                {footer && (
                    <DialogFooter className="shrink-0 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
                        <div className="flex w-full items-center justify-end gap-3">{footer}</div>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};
