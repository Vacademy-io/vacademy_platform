import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { createCatalogueConfig } from '../-services/catalogue-service';
import { useToast } from '@/hooks/use-toast';
import { defaultTemplate } from '../-templates/default-template';

interface CreateCatalogueDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export const CreateCatalogueDialog = ({
    open,
    onOpenChange,
    onSuccess,
}: CreateCatalogueDialogProps) => {
    const [tagName, setTagName] = useState('');
    const instituteId = getCurrentInstituteId();
    const { toast } = useToast();

    const createMutation = useMutation({
        mutationFn: () =>
            createCatalogueConfig(instituteId!, {
                tagName,
                catalogue_json: JSON.stringify(defaultTemplate),
            }),
        onSuccess: () => {
            toast({ title: 'Success', description: 'Page created successfully' });
            onOpenChange(false);
            setTagName('');
            onSuccess();
        },
        onError: (error) => {
            toast({ title: 'Error', description: 'Failed to create page', variant: 'destructive' });
            console.error(error);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tagName) return;
        createMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Page</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="tagName">Tag Name (Route path)</Label>
                        <Input
                            id="tagName"
                            placeholder="e.g. landing-page"
                            value={tagName}
                            onChange={(e) => setTagName(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">
                            This will be the unique identifier for the page route.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!tagName || createMutation.isPending}>
                            {createMutation.isPending ? 'Creating...' : 'Create Page'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
