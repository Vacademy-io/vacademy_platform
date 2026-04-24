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
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default PostFormFillConfigurationCard;
