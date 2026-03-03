// Inquiry Types for the Admissions Module

export type InquirySource =
    | 'WEBSITE_FORM'
    | 'WHATSAPP'
    | 'IVR'
    | 'PHONE_CALL'
    | 'WALK_IN'
    | 'REFERRAL'
    | 'SOCIAL_MEDIA'
    | 'EMAIL'
    | 'OTHER';

export type InquiryStatus =
    | 'NEW'
    | 'CONTACTED'
    | 'INTERESTED'
    | 'FOLLOW_UP'
    | 'CONVERTED'
    | 'NOT_INTERESTED'
    | 'LOST';

export type InquiryPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface InquiryNote {
    id: string;
    content: string;
    createdAt: string;
    createdBy: string;
}

export interface InquiryFollowUp {
    id: string;
    scheduledAt: string;
    type: 'CALL' | 'EMAIL' | 'WHATSAPP' | 'MEETING' | 'OTHER';
    notes?: string;
    completed: boolean;
    completedAt?: string;
    outcome?: string;
}

export interface Inquiry {
    id: string;
    name: string;
    phone: string;
    email?: string;
    source: InquirySource;
    status: InquiryStatus;
    priority: InquiryPriority;
    parentName?: string;
    parentPhone?: string;
    city?: string;
    interestedCourses?: string[];
    interestedBatch?: string;
    initialQuery?: string;
    referredBy?: string;
    assignedTo?: string;
    notes: InquiryNote[];
    followUps: InquiryFollowUp[];
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    instituteId: string;
}

// API Payload Types
export interface CreateInquiryPayload {
    name: string;
    phone: string;
    email?: string;
    source: InquirySource;
    priority?: InquiryPriority;
    parentName?: string;
    parentPhone?: string;
    city?: string;
    interestedCourses?: string[];
    interestedBatch?: string;
    initialQuery?: string;
    referredBy?: string;
}

export interface UpdateInquiryPayload extends Partial<CreateInquiryPayload> {
    id: string;
    status?: InquiryStatus;
    assignedTo?: string;
}

export interface InquiryFilters {
    status?: InquiryStatus[];
    source?: InquirySource[];
    priority?: InquiryPriority[];
    assignedTo?: string;
    dateFrom?: string;
    dateTo?: string;
    searchQuery?: string;
    // Service helpers
    search?: string;
    page?: number;
    size?: number;
}

export interface InquiryListResponse {
    inquiries: Inquiry[];
    total: number;
    page: number;
    pageSize: number;
}

// Configuration Objects for UI Display
export const INQUIRY_SOURCE_CONFIG: Record<
    InquirySource,
    { label: string; icon: string; color: string }
> = {
    WEBSITE_FORM: { label: 'Website', icon: '🌐', color: 'text-blue-600 bg-blue-50' },
    WHATSAPP: { label: 'WhatsApp', icon: '💬', color: 'text-green-600 bg-green-50' },
    IVR: { label: 'IVR', icon: '📞', color: 'text-purple-600 bg-purple-50' },
    PHONE_CALL: { label: 'Phone', icon: '📱', color: 'text-orange-600 bg-orange-50' },
    WALK_IN: { label: 'Walk-in', icon: '🚶', color: 'text-teal-600 bg-teal-50' },
    REFERRAL: { label: 'Referral', icon: '👥', color: 'text-pink-600 bg-pink-50' },
    SOCIAL_MEDIA: { label: 'Social', icon: '📲', color: 'text-indigo-600 bg-indigo-50' },
    EMAIL: { label: 'Email', icon: '✉️', color: 'text-gray-600 bg-gray-50' },
    OTHER: { label: 'Other', icon: '📋', color: 'text-neutral-600 bg-neutral-50' },
};

export const INQUIRY_STATUS_CONFIG: Record<
    InquiryStatus,
    { label: string; color: string; bgColor: string }
> = {
    NEW: { label: 'New', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    CONTACTED: { label: 'Contacted', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
    INTERESTED: { label: 'Interested', color: 'text-green-700', bgColor: 'bg-green-100' },
    FOLLOW_UP: { label: 'Follow Up', color: 'text-orange-700', bgColor: 'bg-orange-100' },
    CONVERTED: { label: 'Converted', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
    NOT_INTERESTED: { label: 'Not Interested', color: 'text-gray-700', bgColor: 'bg-gray-100' },
    LOST: { label: 'Lost', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export const INQUIRY_PRIORITY_CONFIG: Record<
    InquiryPriority,
    { label: string; icon: string; color: string }
> = {
    LOW: { label: 'Low', icon: '🟢', color: 'text-green-600' },
    MEDIUM: { label: 'Medium', icon: '🟡', color: 'text-yellow-600' },
    HIGH: { label: 'High', icon: '🟠', color: 'text-orange-600' },
    URGENT: { label: 'Urgent', icon: '🔴', color: 'text-red-600' },
};
