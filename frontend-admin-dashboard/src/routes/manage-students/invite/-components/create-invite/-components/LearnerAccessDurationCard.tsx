import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';
import { Clock } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';

interface CustomInviteFormCardProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

const LearnerAccessDurationCard = ({ form }: CustomInviteFormCardProps) => {
    return (
        <Card className="mb-4">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Clock size={22} />
                    <CardTitle className="text-2xl font-bold">Learner Access Duration</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                {form.watch('accessDurationType') === 'define' && (
                    <div className="flex flex-col gap-1">
                        <label htmlFor="access-duration-days" className="text-sm font-medium">
                            Access Duration (Days)
                        </label>
                        <Input
                            id="access-duration-days"
                            type="number"
                            min={1}
                            value={form.watch('accessDurationDays')}
                            onChange={(e) => {
                                form.setValue('accessDurationDays', e.target.value);
                            }}
                            placeholder="Enter number of days"
                            className="w-48"
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default LearnerAccessDurationCard;
