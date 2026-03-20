/* eslint-disable */
// @ts-nocheck
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface TranscriptModalProps {
    isOpen: boolean;
    onClose: () => void;
    transcriptText: string;
}

export const TranscriptModal: React.FC<TranscriptModalProps> = ({ isOpen, onClose, transcriptText }) => {

    const handleCopy = () => {
        if (transcriptText) {
            navigator.clipboard.writeText(transcriptText);
            toast.success("Transcript copied to clipboard!");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[625px] flex flex-col h-[70vh]">
                <DialogHeader>
                    <DialogTitle>Audio Transcript</DialogTitle>
                </DialogHeader>
                <div className="flex-grow my-4 overflow-hidden">
                    <div className="h-full w-full rounded-md border bg-slate-50 p-4 overflow-y-auto">
                        <p className="whitespace-pre-wrap text-sm text-slate-800">
                            {transcriptText || "No content."}
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    <Button onClick={handleCopy} disabled={!transcriptText}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Text
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
