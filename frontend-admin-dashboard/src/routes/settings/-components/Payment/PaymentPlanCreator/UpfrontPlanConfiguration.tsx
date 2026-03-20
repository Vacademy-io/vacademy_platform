import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCurrencySymbol } from '../utils/utils';

interface UpfrontPlanConfigurationProps {
    currency: string;
    fullPrice: string;
    onFullPriceChange: (price: string) => void;
}

export const UpfrontPlanConfiguration: React.FC<UpfrontPlanConfigurationProps> = ({
    currency,
    fullPrice,
    onFullPriceChange,
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
                        The total amount students will pay for lifetime access
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};
