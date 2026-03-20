import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormItem, FormControl } from '@/components/ui/form';
import { AddressBook } from '@phosphor-icons/react';
import { MyInput } from '@/components/design-system/input';

interface DiscountSettingsDialogProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

const InviteNameCard = ({ form }: DiscountSettingsDialogProps) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AddressBook size={20} />
                    <span className="text-2xl font-bold">Invite Name</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="-mt-1">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field: { onChange, value, ...field } }) => (
                        <FormItem>
                            <FormControl>
                                <MyInput
                                    inputType="text"
                                    label="Invite Name"
                                    inputPlaceholder="Enter invite name"
                                    input={value}
                                    onChangeFunction={onChange}
                                    required={false}
                                    size="large"
                                    className="w-full"
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    );
};

export default InviteNameCard;
