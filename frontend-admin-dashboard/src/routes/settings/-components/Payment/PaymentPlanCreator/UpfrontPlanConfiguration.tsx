import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getCurrencySymbol } from '../utils/utils';

export type UpfrontAccessType = 'lifetime' | 'limited';

interface UpfrontPlanConfigurationProps {
    currency: string;
    fullPrice: string;
    onFullPriceChange: (price: string) => void;
    accessType: UpfrontAccessType;
    onAccessTypeChange: (accessType: UpfrontAccessType) => void;
    validityDays: number | undefined;
    onValidityDaysChange: (days: number | undefined) => void;
}

export const UpfrontPlanConfiguration: React.FC<UpfrontPlanConfigurationProps> = ({
    currency,
    fullPrice,
    onFullPriceChange,
    accessType,
    onAccessTypeChange,
    validityDays,
    onValidityDaysChange,
}) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">One-Time Payment Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <Label>Full Price ({getCurrencySymbol(currency)}) *</Label>
                    <Input
                        type="number"
                        placeholder="Enter price"
                        value={fullPrice}
                        onChange={(e) => onFullPriceChange(e.target.value)}
                        className="mt-1"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        The total amount students will pay to enroll
                    </p>
                </div>

                <div>
                    <Label>Course Access *</Label>
                    <RadioGroup
                        value={accessType}
                        onValueChange={(value) => onAccessTypeChange(value as UpfrontAccessType)}
                        className="mt-2 flex flex-col gap-2"
                    >
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="lifetime" id="upfront-access-lifetime" />
                            <Label
                                htmlFor="upfront-access-lifetime"
                                className="cursor-pointer font-normal"
                            >
                                Lifetime access
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="limited" id="upfront-access-limited" />
                            <Label
                                htmlFor="upfront-access-limited"
                                className="cursor-pointer font-normal"
                            >
                                Limited access
                            </Label>
                        </div>
                    </RadioGroup>

                    {accessType === 'limited' && (
                        <div className="mt-3">
                            <Label>Access Duration (Days) *</Label>
                            <Input
                                type="number"
                                placeholder="Enter number of days"
                                value={validityDays ?? ''}
                                onChange={(e) =>
                                    onValidityDaysChange(
                                        e.target.value ? parseInt(e.target.value) : undefined
                                    )
                                }
                                className="mt-1"
                                min="1"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Access ends this many days after the learner enrolls. Admins can
                                extend it later from the learner&apos;s profile.
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
