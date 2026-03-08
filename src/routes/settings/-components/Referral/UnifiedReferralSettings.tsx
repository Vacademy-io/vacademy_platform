import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Percent,
    DollarSign,
    Gift,
    Calendar,
    FileText,
    Video,
    Upload,
    Plus,
    Trash2,
    Edit,
    TrendingUp,
    Users,
    Star,
    Link2,
    Music,
    Settings,
    Mail,
    MessageCircle,
} from 'lucide-react';
import { MyButton } from '@/components/design-system/button';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { getTokenFromCookie, getTokenDecodedData } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { TemplateSelector, TemplatePreview } from '@/components/templates';
import { MessageTemplate } from '@/types/message-template-types';

// Enhanced interfaces with multiple programs support
export interface ContentDelivery {
    email: boolean;
    whatsapp: boolean;
    emailTemplate?: {
        id: string;
        name: string;
        subject?: string;
        content: string;
    };
    whatsappTemplate?: {
        id: string;
        name: string;
        content: string;
    };
}

export interface ContentOption {
    type: 'upload' | 'link' | 'existing_course';
    // For upload
    file?: File;
    fileId?: string; // Store the uploaded file ID
    template?: string; // Template selection
    // For link
    url?: string;
    // For existing course
    courseId?: string;
    sessionId?: string;
    levelId?: string;
    // Common
    title: string;
    description?: string;
    delivery: ContentDelivery;
}

export interface RewardContent {
    contentType: 'pdf' | 'video' | 'audio' | 'course';
    content: ContentOption;
}

export interface UnifiedReferralSettings {
    id: string;
    label: string;
    isDefault: boolean;
    requireReferrerActiveInBatch?: boolean;
    // Referee Settings - Simple one-time reward
    refereeReward?: {
        type:
            | 'discount_percentage'
            | 'discount_fixed'
            | 'bonus_content'
            | 'free_days'
            | 'points_system';
        value?: number;
        currency?: string;
        content?: RewardContent;
        courseId?: string;
        sessionId?: string;
        levelId?: string;
        delivery?: ContentDelivery;
        description?: string;
    };

    // Referrer Settings - Tiered rewards
    referrerRewards?: ReferrerTier[];

    // Program Settings
    allowCombineOffers: boolean;
    payoutVestingDays: number;
}

export interface ReferrerTier {
    id: string;
    tierName: string;
    referralCount: number;
    reward: {
        type:
            | 'discount_percentage'
            | 'discount_fixed'
            | 'bonus_content'
            | 'free_days'
            | 'points_system';
        value?: number;
        currency?: string;
        content?: RewardContent;
        courseId?: string;
        sessionId?: string;
        levelId?: string;
        delivery?: ContentDelivery;
        pointsPerReferral?: number;
        pointsToReward?: number;
        pointsRewardType?: 'discount_percentage' | 'discount_fixed' | 'membership_days';
        pointsRewardValue?: number;
        description?: string;
    };
}

interface UnifiedReferralSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: UnifiedReferralSettings) => void;
    editingSettings?: UnifiedReferralSettings | null;
}

export const UnifiedReferralSettings: React.FC<UnifiedReferralSettingsProps> = ({
    isOpen,
    onClose,
    onSave,
    editingSettings,
}) => {
    const [formData, setFormData] = useState<Partial<UnifiedReferralSettings>>({
        label: '',
        isDefault: false,
        allowCombineOffers: false,
        payoutVestingDays: 7,
        refereeReward: {
            type: 'discount_percentage',
            value: 10,
            currency: 'INR',
        },
        referrerRewards: [],
    });
    const [errors, setErrors] = useState<{ label?: boolean; referrerRewards?: boolean }>({});
    const [editingTier, setEditingTier] = useState<ReferrerTier | null>(null);
    const [showTierCreator, setShowTierCreator] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (editingSettings) {
                setFormData(editingSettings);
            } else {
                setFormData({
                    label: '',
                    isDefault: false,
                    allowCombineOffers: false,
                    payoutVestingDays: 7,
                    referrerRewards: [],
                });
            }
        } else {
            // Reset when closed so there's no flash of old data on next open
            setTimeout(() => {
                setFormData({
                    label: '',
                    isDefault: false,
                    allowCombineOffers: false,
                    payoutVestingDays: 7,
                    referrerRewards: [],
                });
            }, 300); // 300ms matches Dialog out animation roughly
        }
    }, [editingSettings, isOpen]);

    const handleSave = () => {
        // 1. Validate Label
        if (!formData.label || formData.label.trim() === '') {
            setErrors({ label: true });
            toast.error('Program Label is required');
            return;
        }

        // 2. Evaluate presence of rewards
        const hasRefereeReward = !!formData.refereeReward;
        const hasReferrerRewards = formData.referrerRewards && formData.referrerRewards.length > 0;

        // 3. Validate 'At Least One' Rule
        if (!hasRefereeReward && !hasReferrerRewards) {
            // Set error on the referrer tier section to visually indicate missing data
            setErrors({ referrerRewards: true });
            toast.error('You must configure either a Referee Benefit or at least one Referrer Reward tier');
            return;
        }

        // 4. Clear all errors if validation passes
        setErrors({});

        // 5. Construct payload
        const settings: UnifiedReferralSettings = {
            id: editingSettings?.id || Date.now().toString(),
            label: formData.label,
            isDefault: formData.isDefault || false,
            requireReferrerActiveInBatch: formData.requireReferrerActiveInBatch || false,
            refereeReward: formData.refereeReward,
            referrerRewards: formData.referrerRewards || [], // Provide fallback empty array if undefined
            allowCombineOffers: formData.allowCombineOffers || false,
            payoutVestingDays: formData.payoutVestingDays || 7,
        };
        onSave(settings);
    };

    const handleAddTier = () => {
        setEditingTier(null);
        setShowTierCreator(true);
    };

    const handleEditTier = (tier: ReferrerTier) => {
        setEditingTier(tier);
        setShowTierCreator(true);
    };

    const handleDeleteTier = (tierId: string) => {
        setFormData((prev) => ({
            ...prev,
            referrerRewards: prev.referrerRewards?.filter((tier) => tier.id !== tierId) || [],
        }));
    };

    const handleSaveTier = (tier: ReferrerTier) => {
        if (editingTier) {
            setFormData((prev) => ({
                ...prev,
                referrerRewards:
                    prev.referrerRewards?.map((t) => (t.id === editingTier.id ? tier : t)) || [],
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                referrerRewards: [...(prev.referrerRewards || []), tier],
            }));
        }
        // Clear the error state if they just added a tier
        if (errors.referrerRewards) {
            setErrors(prev => ({ ...prev, referrerRewards: false }));
        }
        setEditingTier(null);
        setShowTierCreator(false);
    };

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

    const getRewardIcon = (type: string) => {
        switch (type) {
            case 'discount_percentage':
                return <Percent className="size-4" />;
            case 'discount_fixed':
                return <DollarSign className="size-4" />;
            case 'bonus_content':
                return <Gift className="size-4" />;
            case 'free_days':
                return <Calendar className="size-4" />;
            case 'points_system':
                return <Star className="size-4" />;
            default:
                return <Gift className="size-4" />;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-h-[90vh] min-w-fit overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TrendingUp className="size-5" />
                        {editingSettings ? 'Edit Referral Program' : 'Create Referral Program'}
                    </DialogTitle>
                    <DialogDescription>
                        {editingSettings
                            ? 'Modify your referral program settings and rewards'
                            : 'Set up a new referral program to encourage student referrals'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Program Label */}
                    <div className="space-y-2">
                        <Label>
                            Program Label <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={formData.label || ''}
                            onChange={(e) => {
                                setFormData({ ...formData, label: e.target.value });
                                // Clear the error as soon as the user starts typing
                                if (errors.label) setErrors({ ...errors, label: false });
                            }}
                            placeholder="Enter a name for your referral program"
                            className={errors.label ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                    </div>
                    {/* Referee Settings */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Gift className="size-5" />
                                        Referee Benefits (One-time Reward)
                                    </CardTitle>
                                    <p className="text-sm text-gray-600">
                                        What new users get when they use a referral code
                                    </p>
                                </div>
                                {/* Only show Remove button if the reward exists */}
                                {formData.refereeReward && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                        onClick={() =>
                                            setFormData({ ...formData, refereeReward: undefined })
                                        }
                                    >
                                        <Trash2 className="mr-2 size-4" />
                                        Remove Benefit
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {formData.refereeReward ? (
                                <RefereeRewardEditor
                                    reward={formData.refereeReward}
                                    onChange={(reward) =>
                                        setFormData({ ...formData, refereeReward: reward })
                                    }
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-6 text-center">
                                    <Gift className="mb-2 size-8 text-gray-300" />
                                    <p className="mb-4 text-sm text-gray-500">
                                        No referee benefits configured yet.
                                    </p>
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            setFormData({
                                                ...formData,
                                                refereeReward: {
                                                    type: 'discount_percentage',
                                                    value: 10,
                                                    currency: 'INR',
                                                },
                                            })
                                        }
                                    >
                                        <Plus className="mr-2 size-4" />
                                        Add Referee Benefit
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Referrer Tiered Rewards */}
                    <Card className={errors.referrerRewards ? "border-red-500 shadow-sm shadow-red-100" : ""}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="size-5" />
                                        Referrer Rewards (Tiered)
                                    </CardTitle>
                                    <p className="text-sm text-gray-600">
                                        Rewards for referrers based on number of successful
                                        referrals
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {formData.referrerRewards && formData.referrerRewards.length > 0 ? (
                                <div className="space-y-4">
                                    {formData.referrerRewards
                                        .sort((a, b) => a.referralCount - b.referralCount)
                                        .map((tier) => (
                                            <div key={tier.id} className="rounded-lg border p-4">
                                                <div className="mb-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-sm"
                                                        >
                                                            {tier.referralCount} referral
                                                            {tier.referralCount !== 1 ? 's' : ''}
                                                        </Badge>
                                                        <span className="font-medium">
                                                            {tier.tierName}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleEditTier(tier)}
                                                        >
                                                            <Edit className="size-4" />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-red-600"
                                                            onClick={() =>
                                                                handleDeleteTier(tier.id)
                                                            }
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="mb-2 flex items-center gap-2">
                                                    {getRewardIcon(tier.reward.type)}
                                                    <span className="text-sm font-medium">
                                                        {getRewardTypeLabel(tier.reward.type)}
                                                        
                                                        {/* Safely display the specific values based on the reward type */}
                                                        <span className="ml-1 text-gray-500 font-normal">
                                                            {tier.reward.type === 'discount_percentage' && tier.reward.value && (
                                                                `(${tier.reward.value}%)`
                                                            )}
                                                            
                                                            {tier.reward.type === 'discount_fixed' && tier.reward.value && (
                                                                `(${tier.reward.currency === 'INR' ? '₹' : tier.reward.currency === 'USD' ? '$' : tier.reward.currency}${tier.reward.value})`
                                                            )}
                                                            
                                                            {tier.reward.type === 'free_days' && tier.reward.value && (
                                                                `(${tier.reward.value} Days)`
                                                            )}
                                                            
                                                            {tier.reward.type === 'points_system' && tier.reward.pointsPerReferral && (
                                                                `(${tier.reward.pointsPerReferral} pts/referral)`
                                                            )}
                                                        </span>
                                                    </span>
                                                    </div>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center text-gray-500">
                                    <Users className="mx-auto mb-4 size-16 text-gray-300" />
                                    <p className="mb-2 text-lg font-medium">
                                        No reward tiers configured
                                    </p>
                                    <p className="mb-4 text-sm">
                                        Create tiers to reward referrers based on their referral
                                        count
                                    </p>
                                    <Button variant="outline" onClick={handleAddTier}>
                                        <Plus className="mr-2 size-4" />
                                        Add Your First Tier
                                    </Button>
                                </div>
                            )}
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
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Reward Vesting Period (Days)</Label>
                                <Input
                                    type="number"
                                    value={formData.payoutVestingDays || ''}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            payoutVestingDays: parseInt(e.target.value) || 0,
                                        })
                                    }
                                    placeholder="7"
                                    min="0"
                                    max="365"
                                />
                            </div>

                            <div className="flex items-center space-x-2">
                                <Switch
                                    checked={formData.allowCombineOffers || false}
                                    onCheckedChange={(checked) =>
                                        setFormData({ ...formData, allowCombineOffers: checked })
                                    }
                                />
                                <Label>Allow combining with other offers</Label>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={formData.isDefault || false}
                                        onCheckedChange={(checked) =>
                                            setFormData({ ...formData, isDefault: checked })
                                        }
                                    />
                                    <Label>Set as default referral program</Label>
                                </div>
                                <p className="ml-6 text-xs text-gray-600">
                                    Default programs will be automatically selected for new
                                    referrals
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <MyButton buttonType="secondary" onClick={onClose}>
                        Cancel
                    </MyButton>
                    <MyButton buttonType="primary" onClick={handleSave}>
                        {editingSettings ? 'Update Program' : 'Create Program'}
                    </MyButton>
                </div>

                {/* Tier Creator Dialog */}
                {showTierCreator && (
                    <ReferrerTierCreator
                        isOpen={showTierCreator}
                        onClose={() => {
                            setShowTierCreator(false);
                            setEditingTier(null);
                        }}
                        onSave={handleSaveTier}
                        editingTier={editingTier}
                        existingTiers={formData.referrerRewards || []}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
};

// Enhanced Referee Reward Editor Component
interface RefereeRewardEditorProps {
    reward?: UnifiedReferralSettings['refereeReward'];
    onChange: (reward: UnifiedReferralSettings['refereeReward']) => void;
}

const RefereeRewardEditor: React.FC<RefereeRewardEditorProps> = ({ reward, onChange }) => {
    // If no reward is provided, initialize with a default reward
    const currentReward = reward || {
        type: 'discount_percentage' as const,
        value: 10,
        currency: 'INR',
    };

    // If the reward was undefined and we're using default, call onChange to update parent
    React.useEffect(() => {
        if (!reward) {
            const defaultReward = {
                type: 'discount_percentage' as const,
                value: 10,
                currency: 'INR',
            };
            onChange(defaultReward);
        }
    }, [reward, onChange]);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Reward Type</Label>
                <Select
                    value={currentReward.type || 'discount_percentage'}
                    onValueChange={(value) =>
                        onChange({
                            ...currentReward,
                            type: value as NonNullable<UnifiedReferralSettings['refereeReward']>['type']
                        })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="discount_percentage">
                            <div className="flex items-center gap-2">
                                <Percent className="size-4" />
                                Percentage Discount
                            </div>
                        </SelectItem>
                        <SelectItem value="discount_fixed">
                            <div className="flex items-center gap-2">
                                <DollarSign className="size-4" />
                                Fixed Amount Discount
                            </div>
                        </SelectItem>
                        <SelectItem value="bonus_content">
                            <div className="flex items-center gap-2">
                                <Gift className="size-4" />
                                Bonus Content
                            </div>
                        </SelectItem>
                        <SelectItem value="free_days">
                            <div className="flex items-center gap-2">
                                <Calendar className="size-4" />
                                Free Membership Days
                            </div>
                        </SelectItem>
                        <SelectItem value="points_system">
                            <div className="flex items-center gap-2">
                                <Star className="size-4" />
                                Points System
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Conditional Fields based on reward type */}
            {(currentReward.type === 'discount_percentage' ||
                currentReward.type === 'free_days' ||
                currentReward.type === 'points_system') && (
                <div className="space-y-2">
                    <Label>
                        {currentReward.type === 'discount_percentage'
                            ? 'Discount Percentage'
                            : currentReward.type === 'free_days'
                              ? 'Number of Days'
                              : 'Points Earned'}
                    </Label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            value={currentReward.value || ''}
                            onChange={(e) =>
                                onChange({ ...currentReward, value: parseInt(e.target.value) || 0 })
                            }
                            placeholder="Enter value"
                            min="1"
                            max={
                                currentReward.type === 'discount_percentage'
                                    ? '100'
                                    : currentReward.type === 'free_days'
                                      ? '365'
                                      : undefined
                            }
                        />
                        <span className="text-sm text-gray-500">
                            {currentReward.type === 'discount_percentage'
                                ? '%'
                                : currentReward.type === 'free_days'
                                  ? 'days'
                                  : 'points'}
                        </span>
                    </div>
                </div>
            )}

            {currentReward.type === 'discount_fixed' && (
                <div className="space-y-2">
                    <Label>Discount Amount</Label>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            value={currentReward.value || ''}
                            onChange={(e) =>
                                onChange({ ...currentReward, value: parseInt(e.target.value) || 0 })
                            }
                            placeholder="Enter amount"
                            min="1"
                        />
                        <Select
                            value={currentReward.currency || 'INR'}
                            onValueChange={(value) =>
                                onChange({ ...currentReward, currency: value })
                            }
                        >
                            <SelectTrigger className="w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="INR">₹</SelectItem>
                                <SelectItem value="USD">$</SelectItem>
                                <SelectItem value="EUR">€</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {currentReward.type === 'bonus_content' && (
                <ContentEditor
                    content={currentReward.content}
                    onChange={(content) =>
                        onChange({
                            ...currentReward,
                            content,
                            // Also sync delivery to reward level for API compatibility
                            delivery: content.content?.delivery || currentReward.delivery,
                        })
                    }
                />
            )}
        </div>
    );
};

// Enhanced Content Editor Component
interface ContentEditorProps {
    content?: RewardContent;
    onChange: (content: RewardContent) => void;
}

const ContentEditor: React.FC<ContentEditorProps> = ({ content, onChange }) => {
    const [contentType, setContentType] = useState<'pdf' | 'video' | 'audio' | 'course'>(
        content?.contentType || 'pdf'
    );
    const [contentOption, setContentOption] = useState<ContentOption>(
        content?.content || {
            type: 'upload',
            title: '',
            delivery: { email: true, whatsapp: false },
        }
    );
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { uploadFile } = useFileUpload();

    // Create a simple form for the file upload component
    const form = useForm({
        defaultValues: {
            bonusContentFile: null,
        },
    });

    // Get user and institute info for file upload
    const getUploadData = () => {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const data = getTokenDecodedData(accessToken);
        const instituteId = data && Object.keys(data.authorities)[0];
        return { instituteId, userId: 'referral-content-upload' };
    };

    const handleFileSubmit = async (file: File) => {
        try {
            setIsUploading(true);
            const { instituteId } = getUploadData();
            const fileId = await uploadFile({
                file,
                setIsUploading,
                userId: 'referral-content-upload',
                source: instituteId || 'REFERRAL_CONTENT',
                sourceId: 'BONUS_CONTENT',
                publicUrl: true,
            });

            if (fileId) {
                setContentOption((prev) => ({
                    ...prev,
                    file,
                    fileId,
                }));
            }
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    useEffect(() => {
        onChange({
            contentType,
            content: contentOption,
        });
    }, [contentType, contentOption, onChange]);

    const templateOptions = [
        { value: 'template_1', label: 'Template 1' },
        { value: 'template_2', label: 'Template 2' },
        { value: 'template_3', label: 'Template 3' },
    ];

    return (
        <div className="space-y-4 rounded-lg border bg-gray-50 p-4">
            <div className="space-y-2">
                <Label>Content Type</Label>
                <Select
                    value={contentType}
                    onValueChange={(value: 'pdf' | 'video' | 'audio' | 'course') =>
                        setContentType(value)
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pdf">
                            <div className="flex items-center gap-2">
                                <FileText className="size-4" />
                                PDF Document
                            </div>
                        </SelectItem>
                        <SelectItem value="video">
                            <div className="flex items-center gap-2">
                                <Video className="size-4" />
                                Video
                            </div>
                        </SelectItem>
                        <SelectItem value="audio">
                            <div className="flex items-center gap-2">
                                <Music className="size-4" />
                                Audio
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Content Source</Label>
                <Select
                    value={contentOption.type}
                    onValueChange={(value: 'upload' | 'link' | 'existing_course') =>
                        setContentOption({ ...contentOption, type: value })
                    }
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="upload">
                            <div className="flex items-center gap-2">
                                <Upload className="size-4" />
                                Upload File
                            </div>
                        </SelectItem>
                        <SelectItem value="link">
                            <div className="flex items-center gap-2">
                                <Link2 className="size-4" />
                                External Link
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {contentOption.type === 'upload' && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Upload File</Label>
                        {contentOption.fileId ? (
                            <div className="flex items-center justify-between rounded-lg border bg-white p-3">
                                <div className="flex items-center gap-2">
                                    <FileText className="size-4 text-green-600" />
                                    <span className="text-sm text-green-600">
                                        File uploaded successfully
                                    </span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                >
                                    Replace File
                                </Button>
                            </div>
                        ) : (
                            <div className="">
                                <MyButton
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    buttonType="secondary"
                                    layoutVariant="default"
                                    scale="large"
                                    type="button"
                                >
                                    Upload File
                                </MyButton>
                            </div>
                        )}

                        <Form {...form}>
                            <FileUploadComponent
                                fileInputRef={fileInputRef}
                                onFileSubmit={handleFileSubmit}
                                control={form.control}
                                name="bonusContentFile"
                                acceptedFileTypes={
                                    contentType === 'pdf'
                                        ? ['application/pdf']
                                        : contentType === 'video'
                                          ? [
                                                'video/mp4',
                                                'video/quicktime',
                                                'video/x-msvideo',
                                                'video/webm',
                                            ]
                                          : contentType === 'audio'
                                            ? ['audio/*']
                                            : ['application/pdf']
                                }
                                isUploading={isUploading}
                                // className="hidden"
                            />
                        </Form>
                    </div>

                    <div className="space-y-2">
                        <Label>Select Template</Label>
                        <Select
                            value={contentOption.template || ''}
                            onValueChange={(value) =>
                                setContentOption({ ...contentOption, template: value })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a template" />
                            </SelectTrigger>
                            <SelectContent>
                                {templateOptions.map((template) => (
                                    <SelectItem key={template.value} value={template.value}>
                                        {template.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {contentOption.type === 'link' && (
                <div className="space-y-2">
                    <Label>Content URL</Label>
                    <Input
                        type="url"
                        value={contentOption.url || ''}
                        onChange={(e) =>
                            setContentOption({ ...contentOption, url: e.target.value })
                        }
                        placeholder="https://example.com/content"
                    />
                </div>
            )}

            <div className="space-y-2">
                <Label>Content Title</Label>
                <Input
                    value={contentOption.title}
                    onChange={(e) => setContentOption({ ...contentOption, title: e.target.value })}
                    placeholder="e.g., Welcome Bonus Study Guide"
                />
            </div>

            <DeliveryOptionsEditor
                delivery={contentOption.delivery}
                onChange={(delivery) => setContentOption({ ...contentOption, delivery })}
            />
        </div>
    );
};

// Delivery Options Editor Component
interface DeliveryOptionsEditorProps {
    delivery: ContentDelivery;
    onChange: (delivery: ContentDelivery) => void;
}

const DeliveryOptionsEditor: React.FC<DeliveryOptionsEditorProps> = ({ delivery, onChange }) => {
    const [previewTemplate, setPreviewTemplate] = React.useState<MessageTemplate | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

    const handleEmailTemplateSelect = (template: MessageTemplate | null) => {
        const updatedDelivery = { ...delivery };
        if (template) {
            updatedDelivery.emailTemplate = {
                id: template.id,
                name: template.name,
                subject: template.subject,
                content: template.content,
            };
        } else {
            delete updatedDelivery.emailTemplate;
        }
        onChange(updatedDelivery);
    };

    const handleWhatsAppTemplateSelect = (template: MessageTemplate | null) => {
        const updatedDelivery = { ...delivery };
        if (template) {
            updatedDelivery.whatsappTemplate = {
                id: template.id,
                name: template.name,
                content: template.content,
            };
        } else {
            delete updatedDelivery.whatsappTemplate;
        }
        onChange(updatedDelivery);
    };

    const handleEmailTemplatePreview = (template: MessageTemplate) => {
        setPreviewTemplate(template);
        setIsPreviewOpen(true);
    };

    const handleWhatsAppTemplatePreview = (template: MessageTemplate) => {
        setPreviewTemplate(template);
        setIsPreviewOpen(true);
    };

    const handleEmailTemplateCreate = () => {
        // TODO: Implement template creation functionality
        console.log('Create email template');
    };

    const handleWhatsAppTemplateCreate = () => {
        // TODO: Implement template creation functionality
        console.log('Create WhatsApp template');
    };

    return (
        <div className="space-y-4">
            <div>
                <Label>Delivery Methods</Label>
                <div className="mt-2 flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="email-delivery"
                            checked={delivery.email}
                            onCheckedChange={(checked) =>
                                onChange({ ...delivery, email: checked as boolean })
                            }
                        />
                        <Label htmlFor="email-delivery" className="flex items-center gap-2 text-sm">
                            <Mail className="size-4" />
                            Email
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="whatsapp-delivery"
                            checked={delivery.whatsapp}
                            onCheckedChange={(checked) =>
                                onChange({ ...delivery, whatsapp: checked as boolean })
                            }
                        />
                        <Label
                            htmlFor="whatsapp-delivery"
                            className="flex items-center gap-2 text-sm"
                        >
                            <MessageCircle className="size-4" />
                            WhatsApp
                        </Label>
                    </div>
                </div>
            </div>

            {/* Email Template Selection */}
            {delivery.email && (
                <TemplateSelector
                    templateType="EMAIL"
                    variant="dropdown"
                    selectedTemplate={
                        delivery.emailTemplate
                            ? {
                                  id: delivery.emailTemplate.id,
                                  name: delivery.emailTemplate.name,
                                  subject: delivery.emailTemplate.subject,
                                  content: delivery.emailTemplate.content,
                                  type: 'EMAIL',
                                  variables: [],
                                  isDefault: false,
                                  createdAt: '',
                                  updatedAt: '',
                                  instituteId: '',
                              }
                            : null
                    }
                    onTemplateSelect={handleEmailTemplateSelect}
                    onTemplatePreview={handleEmailTemplatePreview}
                    onTemplateCreate={handleEmailTemplateCreate}
                    placeholder="Select email template"
                />
            )}

            {/* WhatsApp Template Selection */}
            {delivery.whatsapp && (
                <TemplateSelector
                    templateType="WHATSAPP"
                    variant="dropdown"
                    selectedTemplate={
                        delivery.whatsappTemplate
                            ? {
                                  id: delivery.whatsappTemplate.id,
                                  name: delivery.whatsappTemplate.name,
                                  content: delivery.whatsappTemplate.content,
                                  type: 'WHATSAPP',
                                  variables: [],
                                  isDefault: false,
                                  createdAt: '',
                                  updatedAt: '',
                                  instituteId: '',
                              }
                            : null
                    }
                    onTemplateSelect={handleWhatsAppTemplateSelect}
                    onTemplatePreview={handleWhatsAppTemplatePreview}
                    onTemplateCreate={handleWhatsAppTemplateCreate}
                    placeholder="Select WhatsApp template"
                />
            )}

            {/* Template Preview Modal */}
            <TemplatePreview
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                template={previewTemplate}
            />
        </div>
    );
};

// Enhanced Referrer Tier Creator Component (same structure but with enhanced content options)
interface ReferrerTierCreatorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (tier: ReferrerTier) => void;
    editingTier?: ReferrerTier | null;
    existingTiers: ReferrerTier[];
}

const ReferrerTierCreator: React.FC<ReferrerTierCreatorProps> = ({
    isOpen,
    onClose,
    onSave,
    editingTier,
}) => {
    const [formData, setFormData] = useState<Partial<ReferrerTier>>({
        tierName: '',
        referralCount: 1,
        reward: {
            type: 'discount_percentage',
            value: 10,
            currency: 'INR',
            pointsRewardType: 'discount_fixed',
        },
    });
    const [errors, setErrors] = useState<{ tierName?: boolean }>({});

    useEffect(() => {
        if (editingTier) {
            setFormData(editingTier);
        } else {
            setFormData({
                tierName: '',
                referralCount: 1,
                reward: {
                    type: 'discount_percentage',
                    value: 10,
                    currency: 'INR',
                    description: '',
                },
            });
        }
    }, [editingTier, isOpen]);

    // Auto-calculate referral count for points system
    useEffect(() => {
        if (
            formData.reward?.type === 'points_system' &&
            formData.reward.pointsPerReferral &&
            formData.reward.pointsToReward &&
            formData.reward.pointsPerReferral > 0
        ) {
            const calculatedReferralCount = Math.ceil(
                formData.reward.pointsToReward / formData.reward.pointsPerReferral
            );
            setFormData((prev) => ({
                ...prev,
                referralCount: calculatedReferralCount,
            }));
        }
    }, [
        formData.reward?.type,
        formData.reward?.pointsPerReferral,
        formData.reward?.pointsToReward,
    ]);

    const handleSave = () => {
        let hasError = false;
        const newErrors: { tierName?: boolean } = {};

        // Validate Tier Name
        if (!formData.tierName || formData.tierName.trim() === '') {
            newErrors.tierName = true;
            hasError = true;
            toast.error('Tier Name is required');
        }

        // Validate Reward (Safety check, though UI usually prevents this from being null)
        if (!formData.reward) {
            hasError = true;
            toast.error('Reward configuration is missing');
        }

        setErrors(newErrors);

        if (hasError) {
            return;
        }

        // Clear errors
        setErrors({});

        const tier: ReferrerTier = {
            id: editingTier?.id || Date.now().toString(),
            tierName: formData.tierName!, // Safe to use ! here because we validated it above
            referralCount: formData.referralCount || 1,
            reward: {
                // ... rest of the existing reward mapping ...
                type: formData.reward!.type as ReferrerTier['reward']['type'],
                value: formData.reward!.value,
                currency: formData.reward!.currency,
                content: formData.reward!.content,
                courseId: formData.reward!.courseId,
                sessionId: formData.reward!.sessionId,
                levelId: formData.reward!.levelId,
                delivery: formData.reward!.delivery,
                pointsPerReferral: formData.reward!.pointsPerReferral,
                pointsToReward: formData.reward!.pointsToReward,
                pointsRewardType: formData.reward!.pointsRewardType,
                pointsRewardValue: formData.reward!.pointsRewardValue,
            },
        };

        onSave(tier);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-h-[85vh] w-[600px] overflow-y-auto ">
                <DialogHeader>
                    <DialogTitle>
                        {editingTier ? 'Edit Reward Tier' : 'Create Reward Tier'}
                    </DialogTitle>
                    <DialogDescription>
                        {editingTier
                            ? 'Modify the reward tier settings and benefits'
                            : 'Create a new reward tier with specific benefits and requirements'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className={errors.tierName ? "text-red-500" : ""}>
                            Tier Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={formData.tierName || ''}
                            onChange={(e) => {
                                setFormData({ ...formData, tierName: e.target.value });
                                // Clear the error when the user starts typing
                                if (errors.tierName) setErrors({ ...errors, tierName: false });
                            }}
                            placeholder="e.g., First Referral, 10 Referrals"
                            className={errors.tierName ? "border-red-500 focus-visible:ring-red-500" : ""}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Referral Count Required</Label>
                        <Input
                            type="number"
                            value={
                                formData.reward?.type === 'points_system' &&
                                formData.reward.pointsPerReferral &&
                                formData.reward.pointsToReward
                                    ? Math.ceil(
                                          formData.reward.pointsToReward /
                                              formData.reward.pointsPerReferral
                                      )
                                    : formData.referralCount || ''
                            }
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    referralCount: parseInt(e.target.value) || 0,
                                })
                            }
                            disabled={
                                !!(
                                    formData.reward?.type === 'points_system' &&
                                    formData.reward.pointsPerReferral &&
                                    formData.reward.pointsToReward
                                )
                            }
                            className={
                                formData.reward?.type === 'points_system' &&
                                formData.reward.pointsPerReferral &&
                                formData.reward.pointsToReward
                                    ? 'cursor-not-allowed bg-gray-100'
                                    : ''
                            }
                        />
                        {formData.reward?.type === 'points_system' &&
                            formData.reward.pointsPerReferral &&
                            formData.reward.pointsToReward && (
                                <p className="text-xs text-gray-600">
                                    Automatically calculated: {formData.reward.pointsToReward}{' '}
                                    points ÷ {formData.reward.pointsPerReferral} points per referral
                                    ={' '}
                                    {Math.ceil(
                                        formData.reward.pointsToReward /
                                            formData.reward.pointsPerReferral
                                    )}{' '}
                                    referrals
                                </p>
                            )}
                    </div>

                    <div className="space-y-2">
                        <Label>Reward Type</Label>
                        <Select
                            value={formData.reward?.type || 'discount_percentage'}
                            onValueChange={(value) =>
                                setFormData({
                                    ...formData,
                                    reward: {
                                        ...formData.reward!,
                                        type: value as
                                            | 'discount_percentage'
                                            | 'discount_fixed'
                                            | 'bonus_content'
                                            | 'free_days'
                                            | 'points_system',
                                    },
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="discount_percentage">
                                    Percentage Discount
                                </SelectItem>
                                <SelectItem value="discount_fixed">
                                    Fixed Amount Discount
                                </SelectItem>
                                <SelectItem value="bonus_content">Bonus Content</SelectItem>
                                <SelectItem value="free_days">Free Membership Days</SelectItem>
                                <SelectItem value="points_system">Points System</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Conditional Fields based on reward type */}
                    {(formData.reward?.type === 'discount_percentage' ||
                        formData.reward?.type === 'free_days') && (
                        <div className="space-y-2">
                            <Label>
                                {formData.reward.type === 'discount_percentage'
                                    ? 'Discount Percentage'
                                    : 'Number of Days'}
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={formData.reward.value || ''}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            reward: {
                                                ...formData.reward!,
                                                value: parseInt(e.target.value) || 0,
                                            },
                                        })
                                    }
                                    placeholder="Enter value"
                                    min="1"
                                    max={
                                        formData.reward.type === 'discount_percentage'
                                            ? '100'
                                            : '365'
                                    }
                                />
                                <span className="text-sm text-gray-500">
                                    {formData.reward.type === 'discount_percentage' ? '%' : 'days'}
                                </span>
                            </div>
                        </div>
                    )}

                    {formData.reward?.type === 'discount_fixed' && (
                        <div className="space-y-2">
                            <Label>Discount Amount</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={formData.reward.value || ''}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            reward: {
                                                ...formData.reward!,
                                                value: parseInt(e.target.value) || 0,
                                            },
                                        })
                                    }
                                    placeholder="Enter amount"
                                    min="1"
                                />
                                <Select
                                    value={formData.reward.currency || 'INR'}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            reward: {
                                                ...formData.reward!,
                                                currency: value,
                                            },
                                        })
                                    }
                                >
                                    <SelectTrigger className="w-24">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INR">₹</SelectItem>
                                        <SelectItem value="USD">$</SelectItem>
                                        <SelectItem value="EUR">€</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {formData.reward?.type === 'bonus_content' && (
                        <ContentEditor
                            content={formData.reward.content}
                            onChange={(content) =>
                                setFormData({
                                    ...formData,
                                    reward: {
                                        ...formData.reward!,
                                        content,
                                        // Also sync delivery to reward level for API compatibility
                                        delivery:
                                            content.content?.delivery || formData.reward!.delivery,
                                    },
                                })
                            }
                        />
                    )}

                    {formData.reward?.type === 'points_system' && (
                        <div className="space-y-4 rounded-lg border bg-gray-50 p-4">
                            <div className="space-y-2">
                                <Label>Points Per Referral</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        value={formData.reward.pointsPerReferral || ''}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                reward: {
                                                    ...formData.reward!,
                                                    pointsPerReferral:
                                                        parseInt(e.target.value) || 0,
                                                },
                                            })
                                        }
                                        placeholder="e.g., 100"
                                        min="1"
                                    />
                                    <span className="text-sm text-gray-500">
                                        points per referral
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600">
                                    How many points the referrer earns for each successful referral
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Points Required for Reward</Label>
                                <Input
                                    type="number"
                                    value={formData.reward.pointsToReward || ''}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            reward: {
                                                ...formData.reward!,
                                                pointsToReward: parseInt(e.target.value) || 0,
                                            },
                                        })
                                    }
                                    placeholder="e.g., 1000"
                                    min="1"
                                />
                                <p className="text-xs text-gray-600">
                                    Total points needed to claim the reward
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Reward Type</Label>
                                <Select
                                    value={formData.reward.pointsRewardType || 'discount_fixed'}
                                    onValueChange={(value) => {
                                        setFormData({
                                            ...formData,
                                            reward: {
                                                ...formData.reward!,
                                                pointsRewardType: value as
                                                    | 'discount_percentage'
                                                    | 'discount_fixed'
                                                    | 'membership_days',
                                            },
                                        });
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="discount_percentage">
                                            Percentage Discount
                                        </SelectItem>
                                        <SelectItem value="discount_fixed">
                                            Fixed Amount Discount
                                        </SelectItem>
                                        <SelectItem value="membership_days">
                                            Free Membership Days
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Reward Value</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        value={formData.reward.pointsRewardValue || ''}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                reward: {
                                                    ...formData.reward!,
                                                    pointsRewardValue:
                                                        parseInt(e.target.value) || 0,
                                                },
                                            })
                                        }
                                        placeholder="Enter value"
                                        min="1"
                                    />
                                    <span className="text-sm text-gray-500">
                                        {formData.reward.pointsRewardType === 'discount_percentage'
                                            ? '%'
                                            : formData.reward.pointsRewardType ===
                                                  'membership_days' && 'days'}
                                    </span>
                                </div>
                            </div>

                            {/* Points System Summary */}
                            <div className="rounded border bg-white p-3">
                                <h5 className="mb-2 text-sm font-medium">Points System Summary</h5>
                                <div className="space-y-1 text-xs text-gray-600">
                                    <div>
                                        • Referrer earns{' '}
                                        <strong>
                                            {formData.reward.pointsPerReferral || 0} points
                                        </strong>{' '}
                                        per successful referral
                                    </div>
                                    <div>
                                        • Needs{' '}
                                        <strong>
                                            {formData.reward.pointsToReward || 0} total points
                                        </strong>{' '}
                                        to claim reward
                                    </div>
                                    <div>
                                        • Requires approximately{' '}
                                        <strong>
                                            {Math.ceil(
                                                (formData.reward.pointsToReward || 0) /
                                                    (formData.reward.pointsPerReferral || 1)
                                            )}{' '}
                                            referrals
                                        </strong>{' '}
                                        to earn reward
                                    </div>
                                    <div>
                                        • Reward:{' '}
                                        <strong>
                                            {formData.reward.pointsRewardValue || 0}
                                            {formData.reward.pointsRewardType ===
                                            'discount_percentage'
                                                ? '% discount'
                                                : formData.reward.pointsRewardType ===
                                                    'membership_days'
                                                  ? ' free days'
                                                  : ' discount'}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <MyButton buttonType="secondary" onClick={onClose}>
                        Cancel
                    </MyButton>
                    <MyButton buttonType="primary" onClick={handleSave}>
                        {editingTier ? 'Update Tier' : 'Create Tier'}
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
};
