import React from 'react';
import {
    Dialog as ShadDialog,
    DialogContent as ShadDialogContent,
    DialogHeader as ShadDialogHeader,
    DialogTitle as ShadDialogTitle,
} from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';
import { UseFormReturn } from 'react-hook-form';
import { AddDiscountFormValues, InviteLinkFormValues } from './GenerateInviteLinkSchema';

interface AddDiscountDialogProps {
    form: UseFormReturn<InviteLinkFormValues>;
    addDiscountForm: UseFormReturn<AddDiscountFormValues>;
    handleAddDiscount: (values: AddDiscountFormValues) => void;
}

export function AddDiscountDialog({
    form,
    addDiscountForm,
    handleAddDiscount,
}: AddDiscountDialogProps) {
    return (
        <ShadDialog
            open={form.watch('showAddDiscountDialog')}
            onOpenChange={(open) => form.setValue('showAddDiscountDialog', open)}
        >
            <ShadDialogContent className="max-w-md">
                <ShadDialogHeader>
                    <ShadDialogTitle>Add New Discount</ShadDialogTitle>
                </ShadDialogHeader>
                <Form {...addDiscountForm}>
                    <form
                        className="space-y-4"
                        onSubmit={addDiscountForm.handleSubmit(handleAddDiscount)}
                    >
                        <FormField
                            control={addDiscountForm.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Discount Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter discount title" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={addDiscountForm.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Discount Code</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter discount code" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={addDiscountForm.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Discount Type</FormLabel>
                                    <FormControl>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="percent">
                                                    Percentage Off
                                                </SelectItem>
                                                <SelectItem value="rupees">Rupees Off</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={addDiscountForm.control}
                            name="value"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Discount Value</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            placeholder={
                                                addDiscountForm.watch('type') === 'percent'
                                                    ? 'Enter percentage (e.g. 10)'
                                                    : 'Enter amount (e.g. 500)'
                                            }
                                            {...field}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={addDiscountForm.control}
                            name="expires"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Expiry Date</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end">
                            <MyButton type="submit" scale="small" buttonType="primary">
                                Save
                            </MyButton>
                        </div>
                    </form>
                </Form>
            </ShadDialogContent>
        </ShadDialog>
    );
}
