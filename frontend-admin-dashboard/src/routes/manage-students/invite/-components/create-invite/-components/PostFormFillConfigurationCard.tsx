import { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';

interface PostFormFillConfigurationCardProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

const PostFormFillConfigurationCard = ({ form }: PostFormFillConfigurationCardProps) => {
    return (
        <Card className="shadow-none rounded-sm bg-neutral-50/50">
            <CardHeader className="border-b bg-neutral-100/50 p-4">
                <CardTitle className="text-base font-semibold text-neutral-800">
                    Post Form Fill Configuration
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-4">
                <div className="grid grid-cols-1 gap-6">
                    <FormField
                        control={form.control}
                        name="postformfillConfiguration.redirectPath"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Redirect Path (Optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="/dashboard or https://example.com" {...field} />
                                </FormControl>
                                <p className="text-xs text-neutral-500">
                                    If set, the user will be instantly redirected to this path after successful enrollment, skipping the success page.
                                </p>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="postformfillConfiguration.showLoginButton"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-sm font-semibold">Show Login Button</FormLabel>
                                    <p className="text-xs text-neutral-500">
                                        Display the login button on the success page if not redirecting immediately.
                                    </p>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="postformfillConfiguration.content"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Success Page Content (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea rows={4} placeholder="HTML/Text Content" {...field} />
                                </FormControl>
                                <p className="text-xs text-neutral-500">
                                    Custom content to display on the success page. Overrides the default message. You may use HTML.
                                </p>
                                <p className="text-xs text-neutral-500">
                                    Supported tokens: <code>{'{{courseName}}'}</code> and <code>{'{{amount}}'}</code>. They are replaced at runtime with the course title and the amount the learner paid for their selected plan.
                                </p>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="postformfillConfiguration.collectBillingContactDetails"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-sm font-semibold">Collect Billing Contact Details</FormLabel>
                                    <p className="text-xs text-neutral-500">
                                        Let learners add a separate billing contact (name, email, role) during enrollment. The billing email also receives invoices and renewal notices.
                                    </p>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    {form.watch('postformfillConfiguration.collectBillingContactDetails') && (
                        <div className="space-y-4 rounded-lg border border-dashed p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                                Billing Contact Fields
                            </p>
                            <p className="text-xs text-neutral-500">
                                Customize the labels learners see, mark fields optional, and (for the third field) supply dropdown options as a comma-separated list. Leave the options blank to render it as a free-text input.
                            </p>

                            {(['name', 'email', 'role'] as const).map((key) => (
                                <div
                                    key={key}
                                    className="grid grid-cols-1 gap-3 rounded-md border bg-white p-3 sm:grid-cols-12"
                                >
                                    <FormField
                                        control={form.control}
                                        name={`postformfillConfiguration.billingContactFields.${key}.label` as const}
                                        render={({ field }) => (
                                            <FormItem className="sm:col-span-6">
                                                <FormLabel className="text-xs">Field {key} label</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Field label" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name={`postformfillConfiguration.billingContactFields.${key}.required` as const}
                                        render={({ field }) => (
                                            <FormItem className="flex items-center justify-between gap-2 sm:col-span-6">
                                                <FormLabel className="text-xs">Required</FormLabel>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {key === 'role' && (
                                        <FormField
                                            control={form.control}
                                            name="postformfillConfiguration.billingContactFields.role.options"
                                            render={({ field }) => (
                                                <FormItem className="sm:col-span-12">
                                                    <FormLabel className="text-xs">Options (comma-separated)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Owner, Manager, Finance"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <p className="text-xs text-neutral-500">
                                                        Leave blank to render this field as a free-text input.
                                                    </p>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default PostFormFillConfigurationCard;
