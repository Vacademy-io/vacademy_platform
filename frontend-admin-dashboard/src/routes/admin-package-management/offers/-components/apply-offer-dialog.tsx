import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MyButton } from '@/components/design-system/button';
import { MarkdownMode } from '@/services/markdown-offers';

interface ApplyOfferDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedCount: number;
    isSubmitting: boolean;
    onSubmit: (mode: MarkdownMode, value: number) => void;
}

export const ApplyOfferDialog = ({
    open,
    onOpenChange,
    selectedCount,
    isSubmitting,
    onSubmit,
}: ApplyOfferDialogProps) => {
    const [mode, setMode] = useState<MarkdownMode>('PERCENT');
    const [value, setValue] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setMode('PERCENT');
            setValue('');
            setError(null);
        }
    }, [open]);

    const handleSubmit = () => {
        const numeric = Number(value);
        if (!value.trim() || Number.isNaN(numeric)) {
            setError('Enter a number.');
            return;
        }
        if (mode === 'PERCENT' && (numeric < 0 || numeric > 100)) {
            setError('Percent must be between 0 and 100.');
            return;
        }
        if (mode === 'ABSOLUTE' && numeric < 0) {
            setError('Price must be 0 or higher.');
            return;
        }
        setError(null);
        onSubmit(mode, numeric);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Apply Offer Price</DialogTitle>
                    <DialogDescription>
                        Lower the actual price below the MRP for {selectedCount} selected
                        {selectedCount === 1 ? ' item' : ' items'}. Elevated price (strike-through MRP)
                        stays unchanged.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Mode</Label>
                        <RadioGroup
                            value={mode}
                            onValueChange={(v) => setMode(v as MarkdownMode)}
                            className="flex flex-col gap-2"
                        >
                            <label className="flex cursor-pointer items-center gap-2">
                                <RadioGroupItem value="PERCENT" id="mode-percent" />
                                <span className="text-sm">Percent off MRP (0–100)</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <RadioGroupItem value="ABSOLUTE" id="mode-absolute" />
                                <span className="text-sm">
                                    Set absolute offer price (must not exceed MRP)
                                </span>
                            </label>
                        </RadioGroup>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="markdown-value">
                            {mode === 'PERCENT' ? 'Percent off' : 'Offer price'}
                        </Label>
                        <Input
                            id="markdown-value"
                            type="number"
                            min={0}
                            max={mode === 'PERCENT' ? 100 : undefined}
                            step="0.01"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={mode === 'PERCENT' ? 'e.g. 20' : 'e.g. 399'}
                            disabled={isSubmitting}
                        />
                        {error ? (
                            <p className="text-xs text-danger-500">{error}</p>
                        ) : null}
                    </div>
                </div>

                <DialogFooter>
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        layoutVariant="default"
                        onClick={() => onOpenChange(false)}
                        disable={isSubmitting}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="small"
                        layoutVariant="default"
                        onClick={handleSubmit}
                        disable={isSubmitting || selectedCount === 0}
                    >
                        {isSubmitting ? 'Applying…' : 'Apply'}
                    </MyButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
