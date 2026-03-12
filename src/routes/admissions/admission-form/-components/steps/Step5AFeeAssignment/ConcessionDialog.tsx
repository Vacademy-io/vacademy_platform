import React, { useMemo } from 'react';
import {
    Dialog as ShadDialog,
    DialogContent as ShadDialogContent,
    DialogHeader as ShadDialogHeader,
    DialogTitle as ShadDialogTitle,
    DialogDescription as ShadDialogDescription,
} from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MyButton } from '@/components/design-system/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    concessionFormSchema,
    ConcessionFormValues,
    CONCESSION_CATEGORIES,
} from '@/routes/admissions/-types/fee-concession-types';

interface AssignedFee {
    id: string;
    name: string;
    amount: number;
    plan: string;
    isMandatory: boolean;
    dueDetails: string;
}

interface ConcessionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fee: AssignedFee;
    onSubmit: (values: ConcessionFormValues) => void;
}

export function ConcessionDialog({ open, onOpenChange, fee, onSubmit }: ConcessionDialogProps) {
    const form = useForm<ConcessionFormValues>({
        resolver: zodResolver(concessionFormSchema),
        defaultValues: {
            concessionType: 'PERCENTAGE',
            concessionValue: 0,
            reason: '',
            category: 'OTHER',
        },
    });

    const watchType = form.watch('concessionType');
    const watchValue = form.watch('concessionValue');

    const adjustedAmount = useMemo(() => {
        if (!watchValue || watchValue <= 0) return fee.amount;
        if (watchType === 'PERCENTAGE') {
            const discount = (fee.amount * Math.min(watchValue, 100)) / 100;
            return Math.max(fee.amount - discount, 0);
        }
        return Math.max(fee.amount - watchValue, 0);
    }, [watchType, watchValue, fee.amount]);

    const concessionAmount = fee.amount - adjustedAmount;

    const handleSubmit = (values: ConcessionFormValues) => {
        onSubmit(values);
        form.reset();
        onOpenChange(false);
    };

    return (
        <ShadDialog open={open} onOpenChange={onOpenChange}>
            <ShadDialogContent className="max-w-md">
                <ShadDialogHeader>
                    <ShadDialogTitle>Apply Concession</ShadDialogTitle>
                    <ShadDialogDescription>
                        Adjust fee amount for this student. This will be sent for approval.
                    </ShadDialogDescription>
                </ShadDialogHeader>

                {/* Fee Info (read-only) */}
                <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">{fee.name}</span>
                        <span className="text-sm font-semibold text-gray-900">
                            ₹ {fee.amount.toLocaleString()}
                        </span>
                    </div>
                    <span className="text-xs text-gray-500">{fee.plan} Plan</span>
                </div>

                <Form {...form}>
                    <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
                        <FormField
                            control={form.control}
                            name="concessionType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Concession Type</FormLabel>
                                    <FormControl>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="PERCENTAGE">
                                                    Percentage Off (%)
                                                </SelectItem>
                                                <SelectItem value="FIXED">
                                                    Fixed Amount Off (₹)
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="concessionValue"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Concession Value{' '}
                                        {watchType === 'PERCENTAGE' ? '(%)' : '(₹)'}
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            placeholder={
                                                watchType === 'PERCENTAGE'
                                                    ? 'Enter percentage (e.g. 10)'
                                                    : 'Enter amount (e.g. 5000)'
                                            }
                                            {...field}
                                            onChange={(e) =>
                                                field.onChange(Number(e.target.value))
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Live-calculated adjusted amount */}
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Original Amount:</span>
                                <span className="font-medium text-gray-800">
                                    ₹ {fee.amount.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Concession:</span>
                                <span className="font-medium text-red-600">
                                    - ₹ {concessionAmount.toLocaleString()}
                                </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between border-t border-blue-200 pt-1">
                                <span className="text-sm font-semibold text-gray-800">
                                    Adjusted Amount:
                                </span>
                                <span className="text-base font-bold text-green-700">
                                    ₹ {adjustedAmount.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <FormControl>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CONCESSION_CATEGORIES.map((cat) => (
                                                    <SelectItem key={cat.value} value={cat.value}>
                                                        {cat.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Reason / Justification{' '}
                                        <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Enter the reason for this concession..."
                                            rows={3}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-2">
                            <MyButton
                                type="button"
                                scale="small"
                                buttonType="secondary"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </MyButton>
                            <MyButton type="submit" scale="small" buttonType="primary">
                                Submit for Approval
                            </MyButton>
                        </div>
                    </form>
                </Form>
            </ShadDialogContent>
        </ShadDialog>
    );
}
