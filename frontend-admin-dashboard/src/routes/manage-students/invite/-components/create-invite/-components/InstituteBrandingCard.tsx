import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building } from '@phosphor-icons/react';
import { FormField, FormItem, FormControl } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';

interface DiscountSettingsDialogProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

const InstituteBrandingCard = ({ form }: DiscountSettingsDialogProps) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Building size={20} />
                    <span className="text-2xl font-bold">Institute Branding</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <FormField
                    control={form.control}
                    name="includeInstituteLogo"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="institute-logo-switch"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                    <span>Include institute logo.</span>
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="blendHeaderWithBackground"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <Switch
                                            id="blend-header-switch"
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                        <span>Match header to theme background.</span>
                                    </div>
                                    <span className="text-caption text-neutral-500">
                                        Puts the logo header and invite title on the page
                                        background instead of white. Only the form stays white.
                                    </span>
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
    );
};

export default InstituteBrandingCard;
