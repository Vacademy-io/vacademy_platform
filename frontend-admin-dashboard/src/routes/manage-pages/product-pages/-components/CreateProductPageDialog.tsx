import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { createProductPage } from '../-services/product-pages-service';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_PRODUCT_PAGE_SETTINGS } from '../-types/product-page-types';

interface CreateProductPageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (productPageId: string) => void;
}

export const CreateProductPageDialog = ({
    open,
    onOpenChange,
    onCreated,
}: CreateProductPageDialogProps) => {
    const [name, setName] = useState('');
    const instituteId = getCurrentInstituteId();
    const { toast } = useToast();

    const createMutation = useMutation({
        mutationFn: () =>
            createProductPage(instituteId!, {
                name,
                status: 'ACTIVE',
                settings_json: JSON.stringify(DEFAULT_PRODUCT_PAGE_SETTINGS),
                mappings: [],
            }),
        onSuccess: (data) => {
            toast({ title: 'Created', description: 'Product page created successfully' });
            onOpenChange(false);
            setName('');
            onCreated(data.id);
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to create product page', variant: 'destructive' });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        createMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Product Page</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="pageName">Page Name</Label>
                        <Input
                            id="pageName"
                            placeholder="e.g. NEET 2025 Bundle"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                        <p className="text-xs text-gray-500">
                            A short, descriptive name for this product page.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                onOpenChange(false);
                                setName('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!name.trim() || createMutation.isPending}
                        >
                            {createMutation.isPending ? 'Creating...' : 'Create & Edit'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
