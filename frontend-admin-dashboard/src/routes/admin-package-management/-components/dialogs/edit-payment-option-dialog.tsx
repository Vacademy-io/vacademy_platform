import { Button } from '@/components/ui/button';
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
import { useState } from 'react';
import { PaymentOption, UpdatePaymentOptionRequest } from '../../-types/package-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePaymentOption } from '../../-services/package-service';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

interface EditPaymentOptionDialogProps {
    paymentOption: PaymentOption;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const EditPaymentOptionDialog = ({
    paymentOption,
    open,
    onOpenChange,
}: EditPaymentOptionDialogProps) => {
    const queryClient = useQueryClient();

    // Transform to request structure
    const [formData, setFormData] = useState<UpdatePaymentOptionRequest>({
        id: paymentOption.id,
        name: paymentOption.name,
        status: paymentOption.status,
        type: paymentOption.type,
        require_approval: paymentOption.require_approval,
        payment_plans: paymentOption.payment_plans.map((p) => ({
            id: p.id,
            actual_price: p.actual_price,
            elevated_price: p.elevated_price,
            currency: p.currency,
            validity_in_days: p.validity_in_days,
        })),
    });

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            await updatePaymentOption(formData);
        },
        onSuccess: () => {
            toast.success('Payment option updated successfully');
            queryClient.invalidateQueries({ queryKey: ['enroll-invite-detail'] });
            onOpenChange(false);
        },
        onError: () => {
            toast.error('Failed to update payment option');
        },
    });

    const handlePlanChange = (index: number, field: string, value: string | number) => {
        const newPlans = [...formData.payment_plans];
        // @ts-expect-error : dynamic assignment
        newPlans[index] = { ...newPlans[index], [field]: value };
        setFormData({ ...formData, payment_plans: newPlans });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="z-[100] max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Edit Payment Option</DialogTitle>
                    <DialogDescription>Modify pricing and plan details.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Option Name</Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(val) => setFormData({ ...formData, type: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[200]">
                                    <SelectItem value="ONE_TIME">One Time</SelectItem>
                                    <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
                                    <SelectItem value="FREE">Free</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end pb-2">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="approval"
                                    checked={formData.require_approval}
                                    onCheckedChange={(checked) =>
                                        setFormData({ ...formData, require_approval: checked })
                                    }
                                />
                                <Label htmlFor="approval">Require Approval</Label>
                            </div>
                        </div>
                    </div>

                    <Separator className="my-2" />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">Payment Plans</h4>
                            {/* Adding plans isn't fully scoped but could be here */}
                        </div>

                        {formData.payment_plans.map((plan, index) => (
                            <div
                                key={index}
                                className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 text-xs"
                            >
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label>Actual Price</Label>
                                        <Input
                                            type="number"
                                            className="h-8"
                                            value={plan.actual_price}
                                            onChange={(e) =>
                                                handlePlanChange(
                                                    index,
                                                    'actual_price',
                                                    parseFloat(e.target.value)
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label>Elevated Price (Strike-through)</Label>
                                        <Input
                                            type="number"
                                            className="h-8"
                                            value={plan.elevated_price}
                                            onChange={(e) =>
                                                handlePlanChange(
                                                    index,
                                                    'elevated_price',
                                                    parseFloat(e.target.value)
                                                )
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-1.5">
                                        <Label>Currency</Label>
                                        <Input
                                            className="h-8"
                                            value={plan.currency}
                                            onChange={(e) =>
                                                handlePlanChange(index, 'currency', e.target.value)
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label>Validity (Days)</Label>
                                        <Input
                                            type="number"
                                            className="h-8"
                                            value={plan.validity_in_days}
                                            onChange={(e) =>
                                                handlePlanChange(
                                                    index,
                                                    'validity_in_days',
                                                    parseInt(e.target.value)
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={() => mutate()} disabled={isPending}>
                        Save Payment
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
