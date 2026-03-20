import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormItem, FormControl } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { WarningCircle } from '@phosphor-icons/react';
import { Textarea } from '@/components/ui/textarea';

interface DiscountSettingsDialogProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

const EnrollmentSettingsCard = ({ form }: DiscountSettingsDialogProps) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl font-bold">Enrollment Settings</CardTitle>
            </CardHeader>
            <CardContent>
                <FormField
                    control={form.control}
                    name="requireApproval"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="w-full">
                                        <div className="text-base font-semibold">
                                            Require Approval
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>
                                                Enable if you want to review and approve enrollment
                                                requests
                                            </span>
                                            <Switch
                                                id="require-approval-switch"
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </div>
                                        {/* Conditional warning and message template */}
                                        {field.value && (
                                            <div className="mt-4 flex flex-col">
                                                <div className="mb-2 flex items-center gap-2 rounded-xl border p-3 text-xs font-medium">
                                                    <WarningCircle size={18} />
                                                    Students will see your message while their
                                                    enrollment request is pending approval.
                                                </div>
                                                <span>Message Template</span>
                                                <FormField
                                                    control={form.control}
                                                    name="messageTemplate"
                                                    render={({ field: templateField }) => (
                                                        <FormItem>
                                                            <Select
                                                                value={
                                                                    templateField.value ||
                                                                    'standard'
                                                                }
                                                                onValueChange={(val) => {
                                                                    templateField.onChange(val);
                                                                    if (val !== 'custom') {
                                                                        form.setValue(
                                                                            'customMessage',
                                                                            undefined
                                                                        );
                                                                    }
                                                                }}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger className="mt-2 w-full">
                                                                        <SelectValue placeholder="Select message template" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="standard">
                                                                        Standard Approval Message
                                                                    </SelectItem>
                                                                    <SelectItem value="review">
                                                                        Custom Review Process
                                                                    </SelectItem>
                                                                    <SelectItem value="custom">
                                                                        Custom Message
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <span className="mt-2">Approval Message</span>
                                                <FormField
                                                    control={form.control}
                                                    name="customMessage"
                                                    render={({ field: msgField }) => {
                                                        const template =
                                                            form.watch('messageTemplate') ||
                                                            'standard';
                                                        let value = msgField.value;
                                                        let disabled = false;
                                                        if (template === 'standard') {
                                                            value =
                                                                'Thank you for your interest in our course. Your enrollment request is being reviewed by our team. We will notify you once your request has been approved.';
                                                            disabled = true;
                                                        } else if (template === 'review') {
                                                            value =
                                                                'Your enrollment request has been received. Our team will review your application within 2 business days. You will receive an email notification with the decision.';
                                                            disabled = true;
                                                        } else if (template === 'custom') {
                                                            disabled = false;
                                                        }
                                                        return (
                                                            <Textarea
                                                                className="mt-3 min-h-[90px]"
                                                                value={value || ''}
                                                                onChange={(e) =>
                                                                    msgField.onChange(
                                                                        e.target.value
                                                                    )
                                                                }
                                                                disabled={disabled}
                                                                placeholder="Enter your custom message..."
                                                            />
                                                        );
                                                    }}
                                                />
                                                <span className="-mb-2 mt-3 text-xs text-neutral-500">
                                                    You can use markdown formatting in your message.
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    );
};

export default EnrollmentSettingsCard;
