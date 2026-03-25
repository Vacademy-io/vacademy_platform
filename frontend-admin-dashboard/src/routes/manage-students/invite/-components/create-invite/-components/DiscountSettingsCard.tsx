import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';
import { MyButton } from '@/components/design-system/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tag, WarningCircle } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';

interface DiscountSettingsDialogProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

const DiscountSettingsCard = ({ form }: DiscountSettingsDialogProps) => {
    return (
        <Card className="mb-4">
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <Tag size={22} />
                    <CardTitle className="text-2xl font-bold">Discount Settings</CardTitle>
                </div>
                <MyButton
                    type="button"
                    scale="small"
                    buttonType="secondary"
                    className="p-4"
                    onClick={() => form.setValue('showDiscountDialog', true)}
                >
                    Change Discount Settings
                </MyButton>
            </CardHeader>
            {form.watch('selectedDiscountId') === 'none' && (
                <Card className="mx-4 mb-4 border">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-2">
                            <WarningCircle size={16} />
                            <span className="text-base font-semibold">No Discount Applied</span>
                        </div>
                        <Badge variant="default" className="ml-2">
                            Active
                        </Badge>
                    </div>
                </Card>
            )}
            {form.watch('selectedDiscountId') &&
                form.watch('selectedDiscountId') !== 'none' &&
                (() => {
                    const activeDiscount = form
                        .getValues('discounts')
                        .find((d) => d.id === form.watch('selectedDiscountId'));
                    if (!activeDiscount) return null;
                    return (
                        <Card className="mx-4 mb-4 border">
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-2">
                                    {activeDiscount.id === 'none' ? (
                                        <WarningCircle size={16} />
                                    ) : (
                                        <Tag size={16} />
                                    )}
                                    <span className="text-base font-semibold">
                                        {activeDiscount.title}
                                    </span>
                                    {form.watch('selectedDiscountId') === activeDiscount.id && (
                                        <Badge variant="default" className="ml-2">
                                            Active
                                        </Badge>
                                    )}
                                    {activeDiscount.code && (
                                        <span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                                            {activeDiscount.code}
                                        </span>
                                    )}
                                </div>
                                <Badge variant="default" className="ml-2">
                                    Active
                                </Badge>
                            </div>
                            <div className="flex items-center gap-4 px-4 pb-4 text-sm">
                                <span className="font-semibold text-green-700">
                                    {activeDiscount.type === 'percent'
                                        ? `${activeDiscount.value}% off`
                                        : `₹${activeDiscount.value} off`}
                                </span>
                                <span className="text-xs text-gray-500">
                                    Expires: {activeDiscount.expires}
                                </span>
                            </div>
                        </Card>
                    );
                })()}
        </Card>
    );
};

export default DiscountSettingsCard;
