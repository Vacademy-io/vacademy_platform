import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Plus, Info } from '@phosphor-icons/react';
import { useState } from 'react';
import {
    GlobalDefaults,
    LevelOption,
    SessionOption,
    CourseType,
    PaymentType,
} from '../-types/bulk-create-types';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { BatchSelectorDialog } from './batch-selector-dialog';

interface GlobalDefaultsSectionProps {
    globalDefaults: GlobalDefaults;
    levels: LevelOption[];
    sessions: SessionOption[];
    onUpdate: (updates: Partial<GlobalDefaults>) => void;
    onAddLevel: (name: string) => Promise<LevelOption>;
    onAddSession: (name: string) => Promise<SessionOption>;
}

const COURSE_TYPES: { value: CourseType; label: string }[] = [
    { value: 'COURSE', label: 'Course' },
    { value: 'MEMBERSHIP', label: 'Membership' },
    { value: 'PRODUCT', label: 'Product' },
    { value: 'SERVICE', label: 'Service' },
];

const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
    { value: 'FREE', label: 'Free' },
    { value: 'ONE_TIME', label: 'One-Time Payment' },
    { value: 'SUBSCRIPTION', label: 'Subscription' },
    { value: 'DONATION', label: 'Donation' },
];

export function GlobalDefaultsSection({
    globalDefaults,
    levels,
    sessions,
    onUpdate,
    onAddLevel,
    onAddSession,
}: GlobalDefaultsSectionProps) {
    const [tagInput, setTagInput] = useState('');
    const [showBatchDialog, setShowBatchDialog] = useState(false);

    const handleAddTag = () => {
        if (tagInput.trim() && !globalDefaults.tags.includes(tagInput.trim())) {
            onUpdate({ tags: [...globalDefaults.tags, tagInput.trim()] });
            setTagInput('');
        }
    };

    const handleRemoveTag = (tag: string) => {
        onUpdate({ tags: globalDefaults.tags.filter((t) => t !== tag) });
    };

    const handleRemoveBatch = (index: number) => {
        const newBatches = [...globalDefaults.batches];
        newBatches.splice(index, 1);
        onUpdate({ batches: newBatches });
    };

    return (
        <div className="rounded-lg border border-neutral-200 bg-gradient-to-br from-blue-50/50 to-white p-4">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-neutral-800">Global Defaults</h3>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="size-4 text-neutral-400" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                    These defaults will be applied to all courses unless overridden
                                    at the course level.
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="global-enabled" className="text-xs text-neutral-600">
                        Apply to all
                    </Label>
                    <Switch
                        id="global-enabled"
                        checked={globalDefaults.enabled}
                        onCheckedChange={(checked) => onUpdate({ enabled: checked })}
                    />
                </div>
            </div>

            {globalDefaults.enabled && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/* Course Type */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-neutral-600">Default Course Type</Label>
                        <Select
                            value={globalDefaults.course_type}
                            onValueChange={(value: CourseType) => onUpdate({ course_type: value })}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COURSE_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Payment Type */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-neutral-600">Default Payment Type</Label>
                        <Select
                            value={globalDefaults.payment_config.payment_type}
                            onValueChange={(value: PaymentType) =>
                                onUpdate({
                                    payment_config: {
                                        ...globalDefaults.payment_config,
                                        payment_type: value,
                                    },
                                })
                            }
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PAYMENT_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Price (if applicable) */}
                    {(globalDefaults.payment_config.payment_type === 'ONE_TIME' ||
                        globalDefaults.payment_config.payment_type === 'SUBSCRIPTION') && (
                        <div className="space-y-1.5">
                            <Label className="text-xs text-neutral-600">Default Price (INR)</Label>
                            <Input
                                type="number"
                                className="h-8 text-xs"
                                placeholder="0"
                                value={globalDefaults.payment_config.price || ''}
                                onChange={(e) =>
                                    onUpdate({
                                        payment_config: {
                                            ...globalDefaults.payment_config,
                                            price: e.target.value ? Number(e.target.value) : undefined,
                                            currency: 'INR',
                                        },
                                    })
                                }
                            />
                        </div>
                    )}

                    {/* Max Slots */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-neutral-600">
                            Max Seats (empty = unlimited)
                        </Label>
                        <Input
                            type="number"
                            className="h-8 text-xs"
                            placeholder="Unlimited"
                            value={globalDefaults.inventory_config.max_slots || ''}
                            onChange={(e) =>
                                onUpdate({
                                    inventory_config: {
                                        max_slots: e.target.value ? Number(e.target.value) : null,
                                        available_slots: e.target.value
                                            ? Number(e.target.value)
                                            : null,
                                    },
                                })
                            }
                        />
                    </div>

                    {/* Publish to Catalogue */}
                    <div className="flex items-center gap-2 pt-5">
                        <Switch
                            id="publish-catalogue"
                            checked={globalDefaults.publish_to_catalogue}
                            onCheckedChange={(checked) =>
                                onUpdate({ publish_to_catalogue: checked })
                            }
                        />
                        <Label htmlFor="publish-catalogue" className="text-xs text-neutral-600">
                            Publish to Catalogue
                        </Label>
                    </div>

                    {/* Default Batches */}
                    <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs text-neutral-600">Default Batches</Label>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setShowBatchDialog(true)}
                            >
                                <Plus className="mr-1 size-3" />
                                Add Batch
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {globalDefaults.batches.length === 0 ? (
                                <span className="text-xs text-neutral-400">
                                    No default batches (will use DEFAULT level/session)
                                </span>
                            ) : (
                                globalDefaults.batches.map((batch, index) => (
                                    <Badge
                                        key={index}
                                        variant="secondary"
                                        className="flex items-center gap-1 text-xs"
                                    >
                                        {batch.level_name || 'DEFAULT'} / {batch.session_name || 'DEFAULT'}
                                        <button
                                            onClick={() => handleRemoveBatch(index)}
                                            className="ml-1 hover:text-red-500"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </Badge>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Default Tags */}
                    <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                        <Label className="text-xs text-neutral-600">Default Tags</Label>
                        <div className="flex gap-2">
                            <Input
                                className="h-8 text-xs"
                                placeholder="Add tag..."
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={handleAddTag}
                            >
                                Add
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {globalDefaults.tags.map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="outline"
                                    className="flex items-center gap-1 text-xs"
                                >
                                    {tag}
                                    <button
                                        onClick={() => handleRemoveTag(tag)}
                                        className="hover:text-red-500"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <BatchSelectorDialog
                open={showBatchDialog}
                onOpenChange={setShowBatchDialog}
                levels={levels}
                sessions={sessions}
                onAddLevel={onAddLevel}
                onAddSession={onAddSession}
                onSelect={(batch) => {
                    onUpdate({ batches: [...globalDefaults.batches, batch] });
                    setShowBatchDialog(false);
                }}
            />
        </div>
    );
}
