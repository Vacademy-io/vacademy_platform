import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from '@phosphor-icons/react';
import { useInstituteTags } from '../-hooks/useInstituteTags';

interface TagSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedTags: string[];
    onConfirm: (tags: string[]) => void;
    title?: string;
    description?: string;
}

export function TagSelectorDialog({
    open,
    onOpenChange,
    selectedTags,
    onConfirm,
    title = 'Select Tags',
    description = 'Pick from existing tags or add your own.',
}: TagSelectorDialogProps) {
    const { tags: instituteTags, isLoading } = useInstituteTags();
    const [draft, setDraft] = useState<string[]>(selectedTags);
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
        if (open) {
            setDraft(selectedTags);
            setNewTag('');
        }
    }, [open, selectedTags]);

    const availableTags = useMemo(
        () => instituteTags.filter((t) => !draft.includes(t)),
        [instituteTags, draft]
    );

    const handleSelect = (tag: string) => {
        if (!draft.includes(tag)) setDraft([...draft, tag]);
    };

    const handleRemove = (tag: string) => {
        setDraft(draft.filter((t) => t !== tag));
    };

    const handleAddCustom = () => {
        const trimmed = newTag.trim();
        if (!trimmed) return;
        if (!draft.includes(trimmed)) setDraft([...draft, trimmed]);
        setNewTag('');
    };

    const handleConfirm = () => {
        onConfirm(draft);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    {/* Selected tags */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-neutral-600">
                            Selected Tags ({draft.length})
                        </Label>
                        <div className="flex min-h-[44px] flex-wrap gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 p-2">
                            {draft.length === 0 ? (
                                <span className="text-xs text-neutral-400">
                                    No tags selected yet
                                </span>
                            ) : (
                                draft.map((tag) => (
                                    <Badge
                                        key={tag}
                                        variant="outline"
                                        className="flex items-center gap-1 rounded-full border-primary-300 bg-primary-50 text-xs text-primary-700"
                                    >
                                        {tag}
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(tag)}
                                            className="hover:text-red-500"
                                            aria-label={`Remove ${tag}`}
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </Badge>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Add custom tag */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-neutral-600">Add a custom tag</Label>
                        <div className="flex gap-2">
                            <Input
                                className="h-9 text-xs"
                                placeholder="Type a tag and press Enter or click Add"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddCustom();
                                    }
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9"
                                onClick={handleAddCustom}
                                disabled={!newTag.trim()}
                            >
                                <Plus className="mr-1 size-3.5" />
                                Add
                            </Button>
                        </div>
                    </div>

                    {/* Available tags from institute */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-neutral-600">
                            Available Tags{' '}
                            {!isLoading && (
                                <span className="text-neutral-400">({availableTags.length})</span>
                            )}
                        </Label>
                        <div className="max-h-48 overflow-y-auto rounded-md border border-neutral-200 p-2">
                            {isLoading ? (
                                <span className="text-xs text-neutral-400">Loading tags...</span>
                            ) : availableTags.length === 0 ? (
                                <span className="text-xs text-neutral-400">
                                    {instituteTags.length === 0
                                        ? 'No institute tags found'
                                        : 'All available tags have been selected'}
                                </span>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {availableTags.map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => handleSelect(tag)}
                                            className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
