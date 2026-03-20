import { UseFormReturn } from 'react-hook-form';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';
import { MyButton } from '@/components/design-system/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Gear, Gift, Percent, Star, TrendUp, Users } from '@phosphor-icons/react';
import { DollarSign } from 'lucide-react';

interface DiscountSettingsDialogProps {
    form: UseFormReturn<InviteLinkFormValues>;
}

export const getReferralTypeLabel = (type: string) => {
    switch (type) {
        case 'discount_percentage':
            return 'Percentage Discount';
        case 'discount_fixed':
            return 'Fixed Discount';
        case 'bonus_content':
            return 'Bonus Content';
        case 'free_days':
            return 'Free Days';
        case 'points_system':
            return 'Points System';
        default:
            return type;
    }
};

export const getReferralTypeIcon = (type: string) => {
    switch (type) {
        case 'discount_percentage':
            return <Percent className="size-4 text-green-600" />;
        case 'discount_fixed':
            return <DollarSign className="size-4 text-green-600" />;
        case 'bonus_content':
            return <Gift className="size-4 text-purple-600" />;
        case 'free_days':
            return <Calendar className="size-4 text-blue-600" />;
        case 'points_system':
            return <Star className="size-4 text-yellow-600" />;
        default:
            return <Gift className="size-4 text-purple-600" />;
    }
};

const ReferralProgramCard = ({ form }: DiscountSettingsDialogProps) => {
    const selectedReferral = form.watch('selectedReferral');
    return (
        <>
            <div className="flex flex-col">
                <div className="flex flex-col">
                    <span className="font-medium">Referral Settings</span>
                    <span className="text-sm">
                        Configure rewards for referrers and referees when referral codes are used
                    </span>
                </div>
            </div>
            <Card className="mb-4">
                <CardHeader className="-mb-5 flex flex-row items-center justify-between ">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-2 text-lg font-semibold">
                            <TrendUp size={20} />
                            <span>{selectedReferral?.name}</span>
                        </span>
                        <Badge variant="default" className="ml-2">
                            Default
                        </Badge>
                    </div>
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="secondary"
                        className="p-4"
                        onClick={() => form.setValue('showReferralDialog', true)}
                    >
                        Change Referral Settings
                    </MyButton>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Referee Benefit */}
                    <div className="mt-2 flex flex-col items-start gap-2">
                        <div className="flex items-center gap-2">
                            <Gift size={18} />
                            <span className="font-semibold">Referee Benefit</span>
                        </div>
                        {selectedReferral?.refereeBenefit?.type === 'free_days' ? (
                            <span className="ml-6 flex items-center gap-1 font-semibold text-green-700">
                                {getReferralTypeIcon(selectedReferral?.refereeBenefit?.type || '')}
                                <span>{selectedReferral?.refereeBenefit?.value} free days</span>
                            </span>
                        ) : selectedReferral?.refereeBenefit?.type === 'bonus_content' ? (
                            <span className="ml-6 flex items-center gap-1 font-semibold text-green-700">
                                {getReferralTypeIcon(selectedReferral?.refereeBenefit?.type || '')}
                                <span>Bonus Content</span>
                            </span>
                        ) : (
                            <span className="ml-6 flex items-center font-semibold text-green-700">
                                {getReferralTypeIcon(selectedReferral?.refereeBenefit?.type || '')}
                                {selectedReferral?.refereeBenefit?.value}
                                &nbsp;off
                            </span>
                        )}
                    </div>
                    {/* Referrer Tiers */}
                    <div className="mt-2 flex flex-col items-start gap-2">
                        <div className="flex items-center gap-2">
                            <Users size={18} />
                            <span className="font-semibold">Referrer Tiers</span>
                        </div>
                        {selectedReferral?.referrerBenefit?.map((benefit, idx) => (
                            <div
                                key={idx}
                                className="ml-4 flex w-full items-center justify-between pr-4"
                            >
                                <span className="ml-2 text-gray-700">{benefit.referralCount}</span>
                                {getReferralTypeIcon(benefit?.type || '')}
                            </div>
                        ))}
                    </div>
                    {/* Program Settings */}
                    <div className="mt-4">
                        <div className="flex items-center gap-2">
                            <Gear size={18} />
                            <span className="font-semibold">Program Settings</span>
                        </div>
                        <div className="ml-6 mt-2 flex items-center justify-between">
                            <span className="text-gray-700">Vesting Period</span>
                            <span>{selectedReferral?.vestingPeriod}</span>
                        </div>
                        <div className="ml-6 mt-2 flex items-center justify-between">
                            <span className="text-gray-700">Combine Offers</span>
                            <span>{selectedReferral?.combineOffers ? 'Yes' : 'No'}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </>
    );
};

export default ReferralProgramCard;
