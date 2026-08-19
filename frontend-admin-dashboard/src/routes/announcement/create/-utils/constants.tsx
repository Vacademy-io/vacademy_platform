import type { Icon } from '@phosphor-icons/react';
import {
    Bell,
    Broadcast,
    ChatCircleDots,
    ClipboardText,
    DeviceMobile,
    EnvelopeSimple,
    FolderSimple,
    Megaphone,
    PushPin,
    UsersThree,
    WhatsappLogo,
} from '@phosphor-icons/react';
import type { MediumType, ModeType } from '@/services/announcement';
import type { ModeSettings, SectionDefinition } from '../-types';

export const FORM_SECTIONS: SectionDefinition[] = [
    { id: 'basics', title: 'Basic Information', caption: 'Title and message' },
    { id: 'recipients', title: 'Recipients', caption: 'Who receives it' },
    { id: 'placements', title: 'Display Locations', caption: 'Where it appears' },
    { id: 'delivery', title: 'Delivery', caption: 'Channels and timing' },
    { id: 'review', title: 'Review & Confirm', caption: 'Final check' },
];

export interface ModeMeta {
    type: ModeType;
    label: string;
    description: string;
    Icon: Icon;
}

/**
 * Display locations, ordered so the two everyday choices lead. `getModeMeta` in the old form
 * rebuilt this array on every render just to inline a preview; previews now live in the
 * preview rail, so this is a plain constant.
 */
export const MODE_META: ModeMeta[] = [
    {
        type: 'SYSTEM_ALERT',
        label: 'System Alert',
        description: 'Appears in the notification centre with a priority and optional expiry.',
        Icon: Bell,
    },
    {
        type: 'DASHBOARD_PIN',
        label: 'Dashboard Pin',
        description: 'Pinned to the dashboard for a defined time window.',
        Icon: PushPin,
    },
    {
        type: 'APP_OVERLAY',
        label: 'App Overlay',
        description: 'Full-screen message shown the next time the app is opened.',
        Icon: DeviceMobile,
    },
    {
        type: 'DM',
        label: 'Direct Message',
        description: 'Lands in the inbox as a message. Replies can be allowed.',
        Icon: ChatCircleDots,
    },
    {
        type: 'STREAM',
        label: 'Stream',
        description: 'Posts to a batch or class discussion stream.',
        Icon: Broadcast,
    },
    {
        type: 'RESOURCES',
        label: 'Resources',
        description: 'Files the announcement into a resources folder.',
        Icon: FolderSimple,
    },
    {
        type: 'COMMUNITY',
        label: 'Community',
        description: 'Posts to a community feed.',
        Icon: UsersThree,
    },
    {
        type: 'TASKS',
        label: 'Tasks',
        description: 'Creates a task with a go-live time and deadline.',
        Icon: ClipboardText,
    },
];

export interface MediumMeta {
    type: MediumType;
    label: string;
    description: string;
    Icon: Icon;
}

export const MEDIUM_META: MediumMeta[] = [
    {
        type: 'PUSH_NOTIFICATION',
        label: 'Push notification',
        description: 'Mobile and web push. Free, instant, best for short nudges.',
        Icon: Megaphone,
    },
    {
        type: 'EMAIL',
        label: 'Email',
        description: 'Rich HTML email from one of your verified sender addresses.',
        Icon: EnvelopeSimple,
    },
    {
        type: 'WHATSAPP',
        label: 'WhatsApp',
        description: 'Sent through an approved WhatsApp Business template.',
        Icon: WhatsappLogo,
    },
];

/** Announcement presets — the two shapes almost every announcement takes. */
export const ANNOUNCEMENT_PRESETS = [
    {
        id: 'GENERAL' as const,
        label: 'General Announcement',
        description: 'General updates and information',
        modes: ['SYSTEM_ALERT'] as ModeType[],
        mediums: ['PUSH_NOTIFICATION', 'EMAIL'] as MediumType[],
        Icon: Megaphone,
    },
    {
        id: 'PINNED' as const,
        label: 'Pinned Update',
        description: 'Important updates pinned on top',
        modes: ['DASHBOARD_PIN'] as ModeType[],
        mediums: ['PUSH_NOTIFICATION'] as MediumType[],
        Icon: PushPin,
    },
];

export function defaultModeSettings(mode: ModeType): ModeSettings {
    switch (mode) {
        case 'SYSTEM_ALERT':
            return { priority: 'HIGH', expiresAt: '' };
        case 'DASHBOARD_PIN':
            return { priority: 10, pinStartTime: '', pinEndTime: '', position: 'TOP' };
        case 'APP_OVERLAY':
            return { priority: 1, showUntil: '', isDismissible: true };
        case 'DM':
            return { messagePriority: 5, allowReplies: true };
        case 'STREAM':
            return { packageSessionId: '', streamType: 'LIVE' };
        case 'RESOURCES':
            return { folderName: '', category: '', accessLevel: 'STUDENTS' };
        case 'COMMUNITY':
            return { communityType: 'SCHOOL', tags: [] };
        case 'TASKS':
            return {
                slideIds: [],
                goLiveDateTime: '',
                deadlineDateTime: '',
                status: 'SCHEDULED',
                taskTitle: '',
                taskDescription: '',
                estimatedDurationMinutes: 0,
                maxAttempts: 1,
                isMandatory: false,
                autoStatusUpdate: true,
                reminderBeforeMinutes: 0,
            };
        default:
            return {};
    }
}

/**
 * Values the notification service substitutes into WhatsApp `dynamic_values` at send time
 * (see `AnnouncementDeliveryService#prepareDynamicValues`). Anything else is sent verbatim.
 */
export const WHATSAPP_VALUE_SOURCES = [
    { value: 'RECIPIENT_NAME', label: "Recipient's name", token: '{{user_name}}' },
    { value: 'ANNOUNCEMENT_TITLE', label: 'Announcement title', token: '{{title}}' },
    { value: 'ANNOUNCEMENT_CONTENT', label: 'Announcement content', token: '{{content}}' },
    { value: 'SENDER_NAME', label: 'Sender name', token: '{{created_by}}' },
    { value: 'CUSTOM', label: 'Custom text…', token: '' },
] as const;

export const CRON_PRESETS = [
    { id: 'DAILY_9', label: 'Every day, 9:00 AM', expression: '0 0 9 * * ?' },
    { id: 'MON_9', label: 'Every Monday, 9:00 AM', expression: '0 0 9 ? * MON' },
    { id: 'HOURLY', label: 'Every hour', expression: '0 0 * * * ?' },
];

export const DEVICE_PRESETS = {
    mobile: { label: 'Mobile', width: 390 },
    tablet: { label: 'Tablet', width: 768 },
    laptop: { label: 'Laptop', width: 1280 },
} as const;

export type PreviewDevice = keyof typeof DEVICE_PRESETS;
