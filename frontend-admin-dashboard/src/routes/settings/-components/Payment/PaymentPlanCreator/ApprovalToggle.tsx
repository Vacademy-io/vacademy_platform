import React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PaymentPlanType } from '@/types/payment';
import { isApprovalToggleDisabled, getApprovalToggleMessage, FreePlanInfo } from '../utils/utils';
import { getTerminology, getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '../../NamingSettings';

interface ApprovalToggleProps {
    planType: PaymentPlanType;
    requireApproval: boolean;
    existingFreePlans: FreePlanInfo[];
    onApprovalChange: (value: boolean) => void;
}

export const ApprovalToggle: React.FC<ApprovalToggleProps> = ({
    planType,
    requireApproval,
    existingFreePlans,
    onApprovalChange,
}) => {
    const { t } = useTranslation('settingsApprovalToggle');
    const isDisabled = isApprovalToggleDisabled(planType, existingFreePlans);
    const message = getApprovalToggleMessage(planType, existingFreePlans);
    const learnerTerm = getTerminologyPlural(
        RoleTerms.Learner,
        SystemTerms.Learner
    ).toLocaleLowerCase();

    return (
        <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
                <Label
                    htmlFor="requireApproval"
                    className={`text-sm font-medium ${
                        isDisabled ? 'text-gray-500' : 'text-gray-900'
                    }`}
                >
                    {t('label.part1')} {learnerTerm} {t('label.part2')}
                </Label>
                <Switch
                    id="requireApproval"
                    checked={requireApproval}
                    onCheckedChange={onApprovalChange}
                    disabled={isDisabled}
                />
            </div>
            {message && (
                <div className="rounded-md bg-blue-50 p-2">
                    <p className="text-xs text-blue-800">{message}</p>
                </div>
            )}
        </div>
    );
};
