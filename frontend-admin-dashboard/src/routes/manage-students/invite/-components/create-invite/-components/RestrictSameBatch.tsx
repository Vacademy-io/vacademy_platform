import { Card } from '@/components/ui/card';
import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';
import { Switch as ShadSwitch } from '@/components/ui/switch';

interface DiscountSettingsDialogProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

const RestrictSameBatch = ({ form }: DiscountSettingsDialogProps) => {
    return (
        <Card className="mb-4 flex flex-row items-center justify-between p-4">
            <div className="flex flex-col">
                <span className="font-semibold">
                    Check if the referrer is a part of the same course and batch?
                </span>
                <span className="text-sm text-gray-600">
                    Enable this to restrict referrals to students from the same batch
                </span>
            </div>
            <ShadSwitch
                checked={form.watch('restrictToSameBatch')}
                onCheckedChange={(value) => form.setValue('restrictToSameBatch', value)}
            />
        </Card>
    );
};

export default RestrictSameBatch;
