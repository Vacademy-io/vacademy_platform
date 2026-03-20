export const TEMPLATE_TYPE_CONFIG = {
    marketing: {
        label: 'Marketing',
        color: '#3B82F6',
        badgeClass: 'bg-blue-100 text-blue-800',
    },
    utility: {
        label: 'Utility',
        color: '#F59E0B',
        badgeClass: 'bg-orange-100 text-orange-800',
    },
    transactional: {
        label: 'Transactional',
        color: '#8B5CF6',
        badgeClass: 'bg-purple-100 text-purple-800',
    },
} as const;

export const STATUS_CONFIG = {
    draft: {
        label: 'Draft',
        color: 'bg-gray-100 text-gray-800',
    },
    active: {
        label: 'Active',
        color: 'bg-green-100 text-green-800',
    },
    inactive: {
        label: 'Inactive',
        color: 'bg-red-100 text-red-800',
    },
} as const;

export const TEMPLATE_TYPE_KEYWORDS = {
    marketing: ['welcome', 'enrollment', 'promotion', 'offer', 'newsletter'],
    utility: ['assignment', 'reminder', 'notification', 'update', 'alert'],
    transactional: ['certificate', 'completion', 'receipt', 'confirmation', 'invoice'],
} as const;

export const DATE_FORMAT_OPTIONS = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
} as const;
