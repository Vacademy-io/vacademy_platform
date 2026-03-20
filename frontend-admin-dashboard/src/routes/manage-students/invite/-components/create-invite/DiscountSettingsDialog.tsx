import React from 'react';
import {
    Dialog as ShadDialog,
    DialogContent as ShadDialogContent,
    DialogHeader as ShadDialogHeader,
    DialogTitle as ShadDialogTitle,
    DialogDescription as ShadDialogDescription,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Prohibit, Tag } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { MyButton } from '@/components/design-system/button';
import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from './GenerateInviteLinkSchema';

interface DiscountSettingsDialogProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

export function DiscountSettingsDialog({ form }: DiscountSettingsDialogProps) {
    return (
        <ShadDialog
            open={form.watch('showDiscountDialog')}
            onOpenChange={(open) => form.setValue('showDiscountDialog', open)}
        >
            <ShadDialogContent className="flex h-[70vh] min-w-[60vw] max-w-lg flex-col">
                <ShadDialogHeader>
                    <ShadDialogTitle>Select Discount Settings</ShadDialogTitle>
                    <ShadDialogDescription>
                        Choose a discount coupon or create a new one
                    </ShadDialogDescription>
                </ShadDialogHeader>
                <div className="mt-4 flex-1 space-y-4 overflow-auto">
                    {form.getValues('discounts')?.map((discount) => (
                        <Card
                            key={discount.id}
                            className={`cursor-pointer flex-col gap-1 border-2 p-4 ${form.watch('selectedDiscountId') === discount.id ? 'border-primary' : 'border-gray-200'} transition-all`}
                            onClick={() => {
                                form.setValue('selectedDiscountId', discount.id);
                                form.setValue('showDiscountDialog', false);
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {discount.id === 'none' ? (
                                        <Prohibit size={16} />
                                    ) : (
                                        <Tag size={16} />
                                    )}
                                    <span className="text-base font-semibold">
                                        {discount.title}
                                    </span>
                                    {form.watch('selectedDiscountId') === discount.id && (
                                        <Badge variant="default" className="ml-2">
                                            Active
                                        </Badge>
                                    )}
                                    {discount.code && (
                                        <span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                                            {discount.code}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {discount.id !== 'none' && (
                                <div className="mt-1 flex items-center gap-4 text-sm">
                                    <span className="font-semibold text-green-700">
                                        {discount.type === 'percent'
                                            ? `${discount.value}% off`
                                            : `₹${discount.value} off`}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        Expires: {discount.expires}
                                    </span>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
                <div className="-mb-2 flex justify-center border-t bg-white pt-4">
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="secondary"
                        onClick={() => form.setValue('showAddDiscountDialog', true)}
                        className="p-4"
                    >
                        + Add New Discount
                    </MyButton>
                </div>
            </ShadDialogContent>
        </ShadDialog>
    );
}
