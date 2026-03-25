// Types for referral system
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

export interface RefereeReward {
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
}

export interface ReferrerReward {
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
}

export interface ReferrerTier {
    id: string;
    tierName: string;
    referralCount: number;
    reward: ReferrerReward;
}

export interface UnifiedReferralSettings {
    id: string;
    label: string;
    isDefault: boolean;
    requireReferrerActiveInBatch?: boolean;
    refereeReward?: RefereeReward;
    referrerRewards?: ReferrerTier[];
    allowCombineOffers: boolean;
    payoutVestingDays: number;
    description?: string;
}
