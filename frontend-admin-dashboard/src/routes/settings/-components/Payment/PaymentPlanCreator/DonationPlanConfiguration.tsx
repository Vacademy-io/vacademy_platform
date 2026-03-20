import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Info } from 'lucide-react';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '../../NamingSettings';
import { getCurrencySymbol } from '../utils/utils';

interface DonationPlanConfigurationProps {
    currency: string;
    suggestedAmounts: string;
    minimumAmount: string;
    allowCustomAmount: boolean;
    newAmount: string;
    onMinimumAmountChange: (amount: string) => void;
    onAllowCustomAmountChange: (allow: boolean) => void;
    onNewAmountChange: (amount: string) => void;
    onAddAmount: () => void;
    onRemoveAmount: (index: number) => void;
}

export const DonationPlanConfiguration: React.FC<DonationPlanConfigurationProps> = ({
    currency,
    suggestedAmounts,
    minimumAmount,
    allowCustomAmount,
    newAmount,
    onMinimumAmountChange,
    onAllowCustomAmountChange,
    onNewAmountChange,
    onAddAmount,
    onRemoveAmount,
}) => {
    useEffect(() => {
        onAllowCustomAmountChange(allowCustomAmount);
    }, []);
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Donation Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label>Suggested Donation Amounts ({getCurrencySymbol(currency)})</Label>
                    <div className="mt-1 flex items-center space-x-2">
                        <Input
                            type="number"
                            min="0"
                            placeholder="Enter amount"
                            value={newAmount}
                            onChange={(e) => onNewAmountChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    onAddAmount();
                                }
                            }}
                            className="flex-1"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onAddAmount}
                            disabled={!newAmount || isNaN(Number(newAmount))}
                        >
                            <Plus className="mr-2 size-4" />
                            Add
                        </Button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                        Add suggested amounts that students can choose from
                    </p>

                    {/* Display current suggested amounts */}
                    {suggestedAmounts && (
                        <div className="mt-3">
                            <Label className="text-sm font-medium">
                                Current Suggested Amounts:
                            </Label>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {suggestedAmounts
                                    .split(',')
                                    .map((amount: string, index: number) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1"
                                        >
                                            <span className="text-sm font-medium">
                                                {getCurrencySymbol(currency)}
                                                {amount.trim()}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto p-0 text-red-600 hover:text-red-700"
                                                onClick={() => onRemoveAmount(index)}
                                            >
                                                <Trash2 className="size-3" />
                                            </Button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <Label>Minimum Donation Amount ({getCurrencySymbol(currency)})</Label>
                    <Input
                        type="number"
                        placeholder="0 for no minimum"
                        value={minimumAmount}
                        onChange={(e) => onMinimumAmountChange(e.target.value)}
                        className="mt-1"
                    />
                </div>

                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="allowCustomAmount"
                        checked={allowCustomAmount}
                        onCheckedChange={onAllowCustomAmountChange}
                    />
                    <Label htmlFor="allowCustomAmount">Allow custom donation amounts</Label>
                </div>

                <Alert>
                    <Info className="size-4" />
                    <AlertDescription>
                        Donation-based {getTerminology(ContentTerms.Course, SystemTerms.Course)} are
                        free to access. Coupon codes are not applicable as{' '}
                        {getTerminology(RoleTerms.Learner, SystemTerms.Learner)} can choose their
                        contribution amount.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
};
