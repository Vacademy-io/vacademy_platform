import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Plus,
    Edit,
    Trash2,
    TrendingUp,
    Users,
    Gift,
    Copy,
    Eye,
    Settings,
    Star,
    Award,
    Percent,
    DollarSign,
    Calendar,
} from 'lucide-react';
import { UnifiedReferralSettings as UnifiedReferralSettingsType } from './UnifiedReferralSettings';
import { MyButton } from '@/components/design-system/button';

interface ReferralManagerProps {
    programs: UnifiedReferralSettingsType[];
    onCreateProgram: () => void;
    onEditProgram: (program: UnifiedReferralSettingsType) => void;
    onDeleteProgram: (programId: string) => void;
    onDuplicateProgram: (program: UnifiedReferralSettingsType) => void;
}

export const ReferralManager: React.FC<ReferralManagerProps> = ({
    programs,
    onCreateProgram,
    onEditProgram,
    onDeleteProgram,
    onDuplicateProgram,
}) => {
    const [selectedProgram, setSelectedProgram] = useState<UnifiedReferralSettingsType | null>(
        null
    );
    const [showProgramDetails, setShowProgramDetails] = useState(false);

    const getRewardTypeIcon = (type: string) => {
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

    const handleViewProgram = (program: UnifiedReferralSettingsType) => {
        setSelectedProgram(program);
        setShowProgramDetails(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Referral Programs</h2>
                    <p className="text-gray-600">
                        Manage multiple referral programs with different reward structures
                    </p>
                </div>
                <MyButton
                    buttonType="primary"
                    onClick={onCreateProgram}
                    className="flex items-center gap-2"
                >
                    <Plus className="size-4" />
                    Create New Program
                </MyButton>
            </div>

            {/* Programs Grid */}
            {programs.length === 0 ? (
                <Card className="py-12 text-center">
                    <CardContent>
                        <h3 className="mb-2 text-lg font-medium">No referral programs created</h3>
                        <p className="mb-4 text-gray-600">
                            Create your first referral program to start incentivizing referrals
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {programs.map((program) => (
                        <Card
                            key={program.id}
                            className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                                program.isDefault
                                    ? 'border-primary-200 bg-gradient-to-br from-primary-50 to-primary-100 shadow-sm'
                                    : 'border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50'
                            }`}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`rounded-lg p-2 ${program.isDefault ? 'bg-primary-100' : 'bg-gray-100'}`}
                                        >
                                            <TrendingUp
                                                className={`size-5 ${program.isDefault ? 'text-primary-500' : 'text-gray-500'}`}
                                            />
                                        </div>
                                        <CardTitle className="text-lg">{program.label}</CardTitle>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {program.isDefault && (
                                            <Badge
                                                variant="default"
                                                className="flex items-center gap-1 bg-primary-500 text-xs text-white"
                                            >
                                                <Award className="size-3" />
                                                Default
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                {/* Referee Benefit Summary */}
                                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                    <div className="mb-3 flex items-center gap-2">
                                        <div className="rounded-md bg-green-100 p-1.5">
                                            <Gift className="size-4 text-green-600" />
                                        </div>
                                        <span className="text-sm font-medium text-gray-800">
                                            Referee Benefit
                                        </span>
                                    </div>
                                    {program.refereeReward ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">
                                                {getRewardTypeIcon(program.refereeReward.type)}
                                            </span>
                                            <div className="text-sm">
                                                {program.refereeReward.type === 'discount_percentage' &&
                                                    `${program.refereeReward.value}% off`}
                                                {program.refereeReward.type === 'discount_fixed' &&
                                                    `₹${program.refereeReward.value} off`}
                                                {program.refereeReward.type === 'free_days' &&
                                                    `${program.refereeReward.value} free days`}
                                                {program.refereeReward.type === 'points_system' &&
                                                    `${program.refereeReward.value} points`}
                                                {program.refereeReward.type === 'bonus_content' && (
                                                    <div className="flex flex-col gap-1">
                                                        <span>
                                                            {program.refereeReward.content?.content
                                                                ?.title || 'Bonus content'}
                                                        </span>
                                                        {program.refereeReward.content?.content
                                                            ?.template && (
                                                            <span className="text-xs text-gray-500">
                                                                Template:{' '}
                                                                {program.refereeReward.content.content.template.replace(
                                                                    'template_',
                                                                    'Template '
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm italic text-gray-500">
                                            No referee benefit configured
                                        </div>
                                    )}
                                </div>

                                {/* Referrer Tiers Summary */}
                                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                    <div className="mb-3 flex items-center gap-2">
                                        <div className="rounded-md bg-blue-100 p-1.5">
                                            <Users className="size-4 text-blue-600" />
                                        </div>
                                        <span className="text-sm font-medium text-gray-800">
                                            Referrer Tiers
                                        </span>
                                    </div>
                                    {program.referrerRewards && program.referrerRewards.length > 0 ? (
                                        <div className="space-y-1">
                                            {program.referrerRewards.slice(0, 2).map((tier) => (
                                                <div
                                                    key={tier.id}
                                                    className="flex items-center justify-between text-xs"
                                                >
                                                    <span>
                                                        {tier.referralCount} referral
                                                        {tier.referralCount !== 1 ? 's' : ''}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span>
                                                            {getRewardTypeIcon(tier.reward.type)}
                                                        </span>
                                                        {tier.reward.type === 'points_system' &&
                                                            tier.reward.pointsPerReferral && (
                                                                <span className="font-medium text-blue-600 text-xs">
                                                                    +{tier.reward.pointsPerReferral}pts
                                                                </span>
                                                            )}
                                                        {tier.reward.type === 'bonus_content' &&
                                                            tier.reward.content?.content?.title && (
                                                                <span className="font-medium text-purple-600 text-xs">
                                                                    {tier.reward.content.content.title}
                                                                </span>
                                                            )}
                                                        {(tier.reward.type === 'discount_percentage' ||
                                                            tier.reward.type === 'discount_fixed' ||
                                                            tier.reward.type === 'free_days') &&
                                                            tier.reward.value && (
                                                                <span className="font-medium text-xs">
                                                                    {tier.reward.value}
                                                                    {tier.reward.type ===
                                                                    'discount_percentage'
                                                                        ? '%'
                                                                        : tier.reward.type ===
                                                                          'free_days'
                                                                          ? 'd'
                                                                          : '₹'}
                                                                </span>
                                                            )}
                                                    </div>
                                                </div>
                                            ))}
                                            {program.referrerRewards.length > 2 && (
                                                <div className="text-xs text-gray-500">
                                                    +{program.referrerRewards.length - 2} more tiers
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-sm italic text-gray-500">
                                            No referrer tiers configured
                                        </div>
                                    )}
                                </div>

                                {/* Program Settings Summary */}
                                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                                    <div className="mb-3 flex items-center gap-2">
                                        <div className="rounded-md bg-gray-100 p-1.5">
                                            <Settings className="size-4 text-gray-600" />
                                        </div>
                                        <span className="text-sm font-medium text-gray-800">
                                            Program Settings
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="rounded bg-gray-50 p-2">
                                            <span className="mb-1 block text-gray-500">
                                                Vesting Period
                                            </span>
                                            <div className="font-medium text-gray-800">
                                                {program.payoutVestingDays} days
                                            </div>
                                        </div>
                                        <div className="rounded bg-gray-50 p-2">
                                            <span className="mb-1 block text-gray-500">
                                                Combine Offers
                                            </span>
                                            <div className="font-medium text-gray-800">
                                                {program.allowCombineOffers === true ? 'Yes' : 'No'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewProgram(program)}
                                        className="flex-1 transition-colors hover:border-blue-300 hover:bg-blue-50"
                                    >
                                        <Eye className="mr-1 size-4" />
                                        View
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEditProgram(program)}
                                        className="transition-colors hover:border-green-300 hover:bg-green-50"
                                    >
                                        <Edit className="size-4" />
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onDuplicateProgram(program)}
                                        className="transition-colors hover:border-purple-300 hover:bg-purple-50"
                                    >
                                        <Copy className="size-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                                        onClick={() => onDeleteProgram(program.id)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Program Details Modal */}
            {showProgramDetails && selectedProgram && (
                <ProgramDetailsModal
                    program={selectedProgram}
                    isOpen={showProgramDetails}
                    onClose={() => {
                        setShowProgramDetails(false);
                        setSelectedProgram(null);
                    }}
                    onEdit={() => {
                        onEditProgram(selectedProgram);
                        setShowProgramDetails(false);
                        setSelectedProgram(null);
                    }}
                />
            )}
        </div>
    );
};

// Program Details Modal Component
interface ProgramDetailsModalProps {
    program: UnifiedReferralSettingsType;
    isOpen: boolean;
    onClose: () => void;
    onEdit: () => void;
}

const ProgramDetailsModal: React.FC<ProgramDetailsModalProps> = ({
    program,
    isOpen,
    onClose,
    onEdit,
}) => {
    if (!isOpen) return null;

    const getRewardTypeLabel = (type: string) => {
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

    const modalContent = (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white">
                <div className="border-b p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">{program.label}</h2>
                            <p className="text-gray-600">Program Details & Configuration</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {program.isDefault && (
                                <Badge variant="default" className="bg-primary-500 text-white">
                                    <Award className="mr-1 size-3" />
                                    Default
                                </Badge>
                            )}
                            <Button onClick={onEdit} className="flex items-center gap-2">
                                <Edit className="size-4" />
                                Edit Program
                            </Button>
                            <Button variant="outline" onClick={onClose}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 p-6">
                    {/* Referee Benefits */}
                    {/* Referee Benefits */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Gift className="size-5 text-green-600" />
                                Referee Benefits (One-time)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Conditional Wrapper Starts Here */}
                            {program.refereeReward ? (
                                <div className="rounded-lg bg-green-50 p-4">
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="font-medium">
                                            {getRewardTypeLabel(program.refereeReward.type)}
                                        </span>
                                        {program.refereeReward.value && (
                                            <Badge variant="secondary">
                                                {program.refereeReward.value}
                                                {program.refereeReward.type === 'discount_percentage'
                                                    ? '%'
                                                    : program.refereeReward.type === 'free_days'
                                                      ? ' days'
                                                      : program.refereeReward.type === 'points_system'
                                                        ? ' points'
                                                        : ''}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-700">
                                        {program.refereeReward.description}
                                    </p>
                                    {program.refereeReward.delivery && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className="text-xs text-gray-500">Delivery:</span>
                                            {program.refereeReward.delivery.email && (
                                                <Badge variant="outline" className="text-xs">
                                                    📧 Email
                                                </Badge>
                                            )}
                                            {program.refereeReward.delivery.whatsapp && (
                                                <Badge variant="outline" className="text-xs">
                                                    💬 WhatsApp
                                                </Badge>
                                            )}
                                        </div>
                                    )}

                                    {/* Bonus Content Details */}
                                    {program.refereeReward.type === 'bonus_content' &&
                                        program.refereeReward.content && (
                                            <div className="mt-3 rounded border bg-white p-3">
                                                <h6 className="mb-2 text-xs font-medium text-gray-700">
                                                    Content Details
                                                </h6>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">
                                                            Content Type:
                                                        </span>
                                                        <span className="font-medium capitalize">
                                                            {program.refereeReward.content.contentType}
                                                        </span>
                                                    </div>
                                                    {program.refereeReward.content.content?.title && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">
                                                                Title:
                                                            </span>
                                                            <span className="font-medium">
                                                                {
                                                                    program.refereeReward.content
                                                                        .content.title
                                                                }
                                                            </span>
                                                        </div>
                                                    )}
                                                    {program.refereeReward.content.content
                                                        ?.template && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">
                                                                Template:
                                                            </span>
                                                            <span className="font-medium">
                                                                {program.refereeReward.content.content.template.replace(
                                                                    'template_',
                                                                    'Template '
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {program.refereeReward.content.content?.fileId && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">File:</span>
                                                            <span className="font-medium text-green-600">
                                                                ✓ Uploaded
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            ) : (
                                /* Fallback if no Referee Benefit exists */
                                <div className="text-sm italic text-gray-500">
                                    No referee benefit configured for this program.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Referrer Tiers */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="size-5 text-blue-600" />
                                Referrer Rewards (Tiered)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {[...(program.referrerRewards || [])]
                                    .sort((a, b) => a.referralCount - b.referralCount)
                                    .map((tier) => (
                                        <div key={tier.id} className="rounded-lg bg-blue-50 p-4">
                                            <div className="mb-2 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary">
                                                        {tier.referralCount} referral
                                                        {tier.referralCount !== 1 ? 's' : ''}
                                                    </Badge>
                                                    <span className="font-medium">
                                                        {tier.tierName}
                                                    </span>
                                                </div>
                                                <span className="font-medium">
                                                    {getRewardTypeLabel(tier.reward.type)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700">
                                                {tier.reward.description}
                                            </p>

                                            {/* Points System Details */}
                                            {tier.reward.type === 'points_system' && (
                                                <div className="mt-3 rounded border bg-white p-3">
                                                    <h6 className="mb-2 text-xs font-medium text-gray-700">
                                                        Points System Details
                                                    </h6>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div>
                                                            <span className="text-gray-500">
                                                                Per Referral:
                                                            </span>
                                                            <div className="font-medium text-blue-600">
                                                                +
                                                                {tier.reward.pointsPerReferral || 0}{' '}
                                                                points
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500">
                                                                Reward at:
                                                            </span>
                                                            <div className="font-medium">
                                                                {tier.reward.pointsToReward || 0}{' '}
                                                                points
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500">
                                                                Referrals needed:
                                                            </span>
                                                            <div className="font-medium">
                                                                {Math.ceil(
                                                                    (tier.reward.pointsToReward ||
                                                                        0) /
                                                                        (tier.reward
                                                                            .pointsPerReferral || 1)
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500">
                                                                Reward:
                                                            </span>
                                                            <div className="font-medium">
                                                                {tier.reward.pointsRewardValue || 0}
                                                                {tier.reward.pointsRewardType ===
                                                                'discount_percentage'
                                                                    ? '% off'
                                                                    : tier.reward
                                                                            .pointsRewardType ===
                                                                        'membership_days'
                                                                      ? ' days'
                                                                      : '₹ off'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {tier.reward.delivery && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="text-xs text-gray-500">
                                                        Delivery:
                                                    </span>
                                                    {tier.reward.delivery.email && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            📧 Email
                                                        </Badge>
                                                    )}
                                                    {tier.reward.delivery.whatsapp && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            💬 WhatsApp
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}

                                            {/* Bonus Content Details for Referrer Tier */}
                                            {tier.reward.type === 'bonus_content' &&
                                                tier.reward.content && (
                                                    <div className="mt-3 rounded border bg-white p-3">
                                                        <h6 className="mb-2 text-xs font-medium text-gray-700">
                                                            Content Details
                                                        </h6>
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500">
                                                                    Content Type:
                                                                </span>
                                                                <span className="font-medium capitalize">
                                                                    {
                                                                        tier.reward.content
                                                                            .contentType
                                                                    }
                                                                </span>
                                                            </div>
                                                            {tier.reward.content.content?.title && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-500">
                                                                        Title:
                                                                    </span>
                                                                    <span className="font-medium">
                                                                        {
                                                                            tier.reward.content
                                                                                .content.title
                                                                        }
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {tier.reward.content.content
                                                                ?.template && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-500">
                                                                        Template:
                                                                    </span>
                                                                    <span className="font-medium">
                                                                        {tier.reward.content.content.template.replace(
                                                                            'template_',
                                                                            'Template '
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {tier.reward.content.content
                                                                ?.fileId && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-500">
                                                                        File:
                                                                    </span>
                                                                    <span className="font-medium text-green-600">
                                                                        ✓ Uploaded
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Program Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="size-5" />
                                Program Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="rounded bg-gray-50 p-3">
                                    <span className="text-sm text-gray-500">Vesting Period</span>
                                    <div className="font-medium">
                                        {program.payoutVestingDays} days
                                    </div>
                                </div>
                                <div className="rounded bg-gray-50 p-3">
                                    <span className="text-sm text-gray-500">
                                        Combine with Other Offers
                                    </span>
                                    <div className="font-medium">
                                        {program.allowCombineOffers===true ? 'Yes' : 'No'}
                                    </div>
                                </div>
                                <div className="rounded bg-gray-50 p-3">
                                    <span className="text-sm text-gray-500">Program Status</span>
                                    <div className="font-medium">
                                        {program.isDefault ? 'Default' : 'Available'}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }

    return modalContent;
};
