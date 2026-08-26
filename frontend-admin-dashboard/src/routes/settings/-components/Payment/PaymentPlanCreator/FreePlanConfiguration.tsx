import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export type FreeAccessType = 'unlimited' | 'limited';

interface FreePlanConfigurationProps {
    accessType: FreeAccessType;
    onAccessTypeChange: (accessType: FreeAccessType) => void;
    validityDays: number | undefined;
    onValidityDaysChange: (days: number | undefined) => void;
}

export const FreePlanConfiguration: React.FC<FreePlanConfigurationProps> = ({
    accessType,
    onAccessTypeChange,
    validityDays,
    onValidityDaysChange,
}) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Free Plan Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <Label>Course Access *</Label>
                    <RadioGroup
                        value={accessType}
                        onValueChange={(value) => onAccessTypeChange(value as FreeAccessType)}
                        className="mt-2 flex flex-col gap-2"
                    >
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="unlimited" id="free-access-unlimited" />
                            <Label
                                htmlFor="free-access-unlimited"
                                className="cursor-pointer font-normal"
                            >
                                Unlimited access
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="limited" id="free-access-limited" />
                            <Label
                                htmlFor="free-access-limited"
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
                        </div>
                    )}

                    <p className="mt-2 text-xs text-gray-500">
                        Applies when an admin assigns a learner to this plan. Learners who enroll
                        themselves through an invite link take their access days from that
                        invite&apos;s Learner Access Duration.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};
