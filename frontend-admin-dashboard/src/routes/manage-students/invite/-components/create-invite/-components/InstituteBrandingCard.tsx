import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building } from 'lucide-react';
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
            <CardContent>
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
            </CardContent>
        </Card>
    );
};

export default InstituteBrandingCard;
