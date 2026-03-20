import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (prompt: string) => Promise<void>;
    isRegenerating: boolean;
}

export const SlideRegenerateModal = ({ isOpen, onClose, onSubmit, isRegenerating }: Props) => {
    const [prompt, setPrompt] = useState('');

    const handleSubmit = async () => {
        if (!prompt.trim()) {
            return;
        }
        await onSubmit(prompt);
    };

    // Reset local prompt state when the modal is closed by the parent
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => setPrompt(''), 200);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={isRegenerating ? () => {} : onClose}>
            <DialogContent
                className={cn(
                    'transition-all duration-500 ease-in-out data-[state=closed]:duration-300',
                    isRegenerating
                        ? 'fixed !bottom-5 !left-auto !right-5 !top-auto !w-[260px] !translate-x-0 !translate-y-0 !rounded-lg !p-4'
                        : 'p-6 sm:max-w-lg'
                )}
                onInteractOutside={(e) => {
                    if (isRegenerating) {
                        e.preventDefault();
                    }
                }}
            >
                {isRegenerating ? (
                    <div className="flex h-full items-center space-x-3">
                        <Loader2 className="size-6 animate-spin text-purple-500" />
                        <span className="font-semibold text-neutral-700">Regenerating...</span>
                    </div>
                ) : (
                    <>
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-xl font-semibold">
                                Regenerate Slide with AI
                            </DialogTitle>
                            <DialogDescription className="text-sm text-neutral-500">
                                Describe the changes you want to make to this slide. The current
                                content will be sent to the AI for modification.
                            </DialogDescription>
                        </DialogHeader>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSubmit();
                            }}
                            className="space-y-5"
                        >
                            <div>
                                <Label
                                    htmlFor="ai-regenerate-prompt"
                                    className="text-sm font-medium"
                                >
                                    Your Instructions
                                </Label>
                                <Textarea
                                    id="ai-regenerate-prompt"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="mt-1.5 min-h-[100px] w-full"
                                    placeholder="e.g., Make this slide more professional. Use a blue color scheme and a cleaner layout."
                                    required
                                    rows={4}
                                    disabled={isRegenerating}
                                />
                            </div>
                            <DialogFooter className="mt-6 !justify-stretch space-y-2 sm:flex sm:flex-row sm:space-x-3 sm:space-y-0">
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    onClick={onClose}
                                    className="w-full sm:w-auto"
                                    disabled={isRegenerating}
                                >
                                    Cancel
                                </MyButton>
                                <MyButton
                                    type="submit"
                                    className="w-full sm:w-auto"
                                    disabled={isRegenerating || !prompt.trim()}
                                >
                                    {isRegenerating ? (
                                        <>
                                            <Loader2 className="mr-2 size-4 animate-spin" />
                                            Please wait...
                                        </>
                                    ) : (
                                        'Regenerate Slide'
                                    )}
                                </MyButton>
                            </DialogFooter>
                        </form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
