import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { PdfViewerComponent } from '@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/pdf-viewer-component';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ACCEPT_TNC } from '@/constants/urls';
import { useInstituteFeatureStore } from '@/stores/insititute-feature-store';

interface TncModalProps {
    tncUrl: string;
    onAccepted: () => void;
}

export function TncModal({ tncUrl, onAccepted }: TncModalProps) {
    const { instituteId } = useInstituteFeatureStore();
    const [hasRead, setHasRead] = useState(false);
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAccept = async () => {
        if (!hasRead) {
            toast.error('Please confirm you have read and agree to the Terms & Conditions');
            return;
        }
        if (!name.trim()) {
            toast.error('Please enter your full name to accept');
            return;
        }
        
        setIsSubmitting(true);
        try {
            await authenticatedAxiosInstance.post(ACCEPT_TNC, {
                institute_id: instituteId || '',
                name: name.trim()
            });
            toast.success('Terms & Conditions accepted successfully');
            onAccepted();
        } catch (error) {
            console.error('Failed to accept T&C:', error);
            toast.error('Failed to accept Terms & Conditions. Please try again.');
            setIsSubmitting(false); // we keep modal open to let them retry
        }
    };

    return (
        <Dialog open={true} onOpenChange={() => {}}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-4 bg-white" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="text-xl">Accept Terms & Conditions</DialogTitle>
                    <DialogDescription>
                        You must read and accept the institute's Terms & Conditions before accessing your dashboard.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 min-h-0 border rounded-md relative bg-gray-50 flex flex-col">
                    <PdfViewerComponent 
                        pdfUrl={tncUrl} 
                        handleDocumentLoad={() => {}} 
                        handlePageChange={() => {}} 
                    />
                    <div className="absolute inset-x-0 bottom-0 pointer-events-none p-4 bg-gradient-to-t from-white/90 to-transparent flex justify-center pb-8 opacity-0 hover:opacity-100 transition-opacity">
                        <span className="bg-black/60 text-white px-3 py-1 text-xs rounded-full pointer-events-auto shadow-sm">
                            Scroll to read
                        </span>
                    </div>
                </div>

                <div className="pt-4 border-t space-y-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="tnc-read-check" 
                            checked={hasRead} 
                            onCheckedChange={(checked) => setHasRead(checked as boolean)}
                        />
                        <Label htmlFor="tnc-read-check" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            I have read and agree to the Terms & Conditions
                        </Label>
                    </div>

                    {hasRead && (
                        <div className="rounded-md bg-primary-50 p-4 border border-primary-100 animate-in fade-in slide-in-from-bottom-2">
                            <Label htmlFor="tnc-name" className="text-sm font-medium text-primary-900 mb-1.5 block">
                                Digital Signature
                            </Label>
                            <Input 
                                id="tnc-name" 
                                placeholder="Enter your full legal name" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)}
                                className="bg-white"
                                autoFocus
                            />
                            <p className="text-xs text-primary-600 mt-2">
                                By entering your name and clicking Accept, you are digitally signing this document.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-2">
                    <Button 
                        disabled={!hasRead || !name.trim() || isSubmitting} 
                        onClick={handleAccept}
                        className="w-full sm:w-auto"
                    >
                        {isSubmitting ? 'Accepting...' : 'I Accept & Continue'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
