import { useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from '@phosphor-icons/react';
import { BatchConfig, LevelOption, SessionOption, PaymentType } from '../-types/bulk-create-types';
import { toast } from 'sonner';

interface BatchSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    levels: LevelOption[];
    sessions: SessionOption[];
    onAddLevel: (name: string) => Promise<LevelOption>;
    onAddSession: (name: string) => Promise<SessionOption>;
    onSelect: (batch: BatchConfig) => void;
    existingBatches?: BatchConfig[];
}

const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
    { value: 'FREE', label: 'Free' },
    { value: 'ONE_TIME', label: 'One-Time Payment' },
    { value: 'SUBSCRIPTION', label: 'Subscription' },
    { value: 'DONATION', label: 'Donation' },
];

export function BatchSelectorDialog({
    open,
    onOpenChange,
    levels,
    sessions,
    onAddLevel,
    onAddSession,
    onSelect,
    existingBatches = [],
}: BatchSelectorDialogProps) {
    const [selectedLevel, setSelectedLevel] = useState<string>('');
    const [selectedSession, setSelectedSession] = useState<string>('');
    const [newLevelName, setNewLevelName] = useState('');
    const [newSessionName, setNewSessionName] = useState('');
    const [isCreatingLevel, setIsCreatingLevel] = useState(false);
    const [isCreatingSession, setIsCreatingSession] = useState(false);

    // Inventory config
    const [maxSlots, setMaxSlots] = useState<string>('');

    // Payment config - now at batch level
    const [paymentType, setPaymentType] = useState<PaymentType>('FREE');
    const [price, setPrice] = useState<string>('');
    const [validityDays, setValidityDays] = useState<string>('');

    const handleCreateLevel = async () => {
        if (!newLevelName.trim()) {
            toast.error('Please enter a level name');
            return;
        }

        setIsCreatingLevel(true);
        try {
            const newLevel = await onAddLevel(newLevelName.trim());
            setSelectedLevel(newLevel.id);
            setNewLevelName('');
            toast.success(`Level "${newLevel.name}" created`);
        } catch (error) {
            toast.error('Failed to create level');
        } finally {
            setIsCreatingLevel(false);
        }
    };

    const handleCreateSession = async () => {
        if (!newSessionName.trim()) {
            toast.error('Please enter a session name');
            return;
        }

        setIsCreatingSession(true);
        try {
            const newSession = await onAddSession(newSessionName.trim());
            setSelectedSession(newSession.id);
            setNewSessionName('');
            toast.success(`Session "${newSession.name}" created`);
        } catch (error) {
            toast.error('Failed to create session');
        } finally {
            setIsCreatingSession(false);
        }
    };

    const handleConfirm = () => {
        const effectiveLevelId = selectedLevel === 'DEFAULT_VALUE' ? '' : selectedLevel;
        const effectiveSessionId = selectedSession === 'DEFAULT_VALUE' ? '' : selectedSession;

        const levelOption = levels.find((l) => l.id === effectiveLevelId);
        const sessionOption = sessions.find((s) => s.id === effectiveSessionId);

        // Validate price for paid types
        if ((paymentType === 'ONE_TIME' || paymentType === 'SUBSCRIPTION') && !price) {
            toast.error('Please enter a price for paid courses');
            return;
        }

        const batch: BatchConfig = {
            level_id: effectiveLevelId || null,
            session_id: effectiveSessionId || null,
            level_name: levelOption?.name || 'DEFAULT',
            session_name: sessionOption?.name || 'DEFAULT',
            inventory_config: maxSlots
                ? {
                      max_slots: Number(maxSlots),
                      available_slots: Number(maxSlots),
                  }
                : undefined,
            payment_config: {
                payment_type: paymentType,
                price: price ? Number(price) : undefined,
                validity_in_days: validityDays ? Number(validityDays) : undefined,
                currency: 'INR',
            },
        };

        const isDuplicate = existingBatches.some(
            (b) => b.level_id === batch.level_id && b.session_id === batch.session_id
        );

        if (isDuplicate) {
            toast.error('This batch combination already exists');
            return;
        }

        onSelect(batch);
        resetForm();
    };

    const resetForm = () => {
        setSelectedLevel('');
        setSelectedSession('');
        setNewLevelName('');
        setNewSessionName('');
        setMaxSlots('');
        setPaymentType('FREE');
        setPrice('');
        setValidityDays('');
    };

    const showPriceField = paymentType === 'ONE_TIME' || paymentType === 'SUBSCRIPTION';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Batch</DialogTitle>
                    <DialogDescription>
                        Configure level, session, payment, and inventory for this batch.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Level Selection */}
                    <div className="space-y-2">
                        <Label className="text-sm">Level</Label>
                        <Tabs defaultValue="existing" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="existing" className="text-xs">
                                    Select Existing
                                </TabsTrigger>
                                <TabsTrigger value="new" className="text-xs">
                                    Create New
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="existing" className="mt-2">
                                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Select level (or leave for DEFAULT)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DEFAULT_VALUE">DEFAULT</SelectItem>
                                        {levels.map((level) => (
                                            <SelectItem key={level.id} value={level.id}>
                                                {level.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </TabsContent>
                            <TabsContent value="new" className="mt-2">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Enter new level name"
                                        value={newLevelName}
                                        onChange={(e) => setNewLevelName(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                    <Button
                                        size="sm"
                                        onClick={handleCreateLevel}
                                        disabled={isCreatingLevel}
                                    >
                                        <Plus className="size-4" />
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Session Selection */}
                    <div className="space-y-2">
                        <Label className="text-sm">Session</Label>
                        <Tabs defaultValue="existing" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="existing" className="text-xs">
                                    Select Existing
                                </TabsTrigger>
                                <TabsTrigger value="new" className="text-xs">
                                    Create New
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="existing" className="mt-2">
                                <Select value={selectedSession} onValueChange={setSelectedSession}>
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Select session (or leave for DEFAULT)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DEFAULT_VALUE">DEFAULT</SelectItem>
                                        {sessions.map((session) => (
                                            <SelectItem key={session.id} value={session.id}>
                                                {session.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </TabsContent>
                            <TabsContent value="new" className="mt-2">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Enter new session name"
                                        value={newSessionName}
                                        onChange={(e) => setNewSessionName(e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                    <Button
                                        size="sm"
                                        onClick={handleCreateSession}
                                        disabled={isCreatingSession}
                                    >
                                        <Plus className="size-4" />
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-neutral-200 pt-2">
                        <p className="text-xs font-medium text-neutral-500">
                            Payment & Inventory (Batch-level)
                        </p>
                    </div>

                    {/* Payment Type */}
                    <div className="space-y-2">
                        <Label className="text-sm">Payment Type</Label>
                        <Select
                            value={paymentType}
                            onValueChange={(val) => setPaymentType(val as PaymentType)}
                        >
                            <SelectTrigger className="h-9 text-sm">
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

                    {/* Price - only show for paid types */}
                    {showPriceField && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-sm">Price (₹) *</Label>
                                <Input
                                    type="number"
                                    placeholder="e.g., 499"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm">Validity (Days)</Label>
                                <Input
                                    type="number"
                                    placeholder="e.g., 365"
                                    value={validityDays}
                                    onChange={(e) => setValidityDays(e.target.value)}
                                    className="h-9 text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* Max Slots */}
                    <div className="space-y-2">
                        <Label className="text-sm">Max Seats (optional)</Label>
                        <Input
                            type="number"
                            placeholder="Leave empty for unlimited"
                            value={maxSlots}
                            onChange={(e) => setMaxSlots(e.target.value)}
                            className="h-9 text-sm"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm}>Add Batch</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
