import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface FreePlanConfigurationProps {
    validityDays: number;
    onValidityDaysChange: (days: number) => void;
}

export const FreePlanConfiguration: React.FC<FreePlanConfigurationProps> = ({
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
                    <Label>Validity Period (Days) *</Label>
                    <Input
                        type="number"
                        placeholder="Enter number of days"
                        value={validityDays || ''}
                        onChange={(e) => onValidityDaysChange(parseInt(e.target.value) || 0)}
                        className="mt-1"
                        min="1"
                        max="365"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        How long the free access will be valid (1-365 days)
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};
