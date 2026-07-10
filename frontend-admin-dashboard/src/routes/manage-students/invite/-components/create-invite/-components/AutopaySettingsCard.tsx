import { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormControl } from '@/components/ui/form';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';

interface AutopaySettingsCardProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

/**
 * Autopay + free-trial config for an invite's paid subscription plans. When
 * enabled, enrolling registers a recurring mandate (UPI Autopay / card) and the
 * subscription auto-renews; trialDays > 0 grants access now and takes the first
 * charge after the trial. Persisted to setting_json.setting.AUTOPAY_SETTING and
 * read at enrollment time.
 */
const AutopaySettingsCard = ({ form }: AutopaySettingsCardProps) => {
    const enabled = form.watch('autopaySettings.enabled');
    const planType = form.watch('selectedPlan')?.type?.toLowerCase();

    // Autopay only applies to recurring (subscription) plans — hide otherwise.
    if (planType !== 'subscription') {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                    <ArrowsClockwise size={22} />
                    Autopay &amp; Free Trial
                </CardTitle>
            </CardHeader>
            <CardContent>
                <FormField
                    control={form.control}
                    name="autopaySettings.enabled"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="w-full">
                                        <div className="text-base font-semibold">
                                            Auto-renew paid subscriptions
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>
                                                Charge the learner&apos;s saved payment method (UPI
                                                mandate / card) automatically at each renewal.
                                                Learners can cancel anytime.
                                            </span>
                                            <Switch
                                                id="enable-autopay-switch"
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />

                {enabled && (
                    <div className="mt-4 border-t pt-4">
                        <span className="text-sm font-medium">Free Trial (days)</span>
                        <FormField
                            control={form.control}
                            name="autopaySettings.trialDays"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            className="mt-2 w-40"
                                            placeholder="0"
                                            value={field.value ?? 0}
                                            onChange={(e) =>
                                                field.onChange(
                                                    e.target.value === ''
                                                        ? 0
                                                        : Number(e.target.value)
                                                )
                                            }
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="mt-1 text-xs text-muted-foreground">
                            Give access now and take the first payment after this many days. Leave 0
                            to charge immediately and renew each cycle.
                        </div>

                        <div className="mt-4">
                            <span className="text-sm font-medium">
                                Mandate limit (max charge per renewal)
                            </span>
                            <FormField
                                control={form.control}
                                name="autopaySettings.maxAmount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                className="mt-2 w-40"
                                                placeholder="Defaults to plan price"
                                                value={field.value ?? ''}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.value === ''
                                                            ? null
                                                            : Number(e.target.value)
                                                    )
                                                }
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <div className="mt-1 text-xs text-muted-foreground">
                                The mandate authorizes each auto-charge up to this cap, so it must be
                                at least the plan&apos;s recurring price. Leave blank to use the plan
                                price; set higher to leave headroom for tax / price changes.
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default AutopaySettingsCard;
