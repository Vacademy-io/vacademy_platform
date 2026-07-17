import type {
    ActionStatus,
    ChannelKey,
    EngineLanguage,
    EngineStatus,
    ProposalStatus,
} from '../-types';

// StatusChip variants live in @/components/design-system/utils (getStatusChipColor). We map to
// simple semantic tones the badge component understands; keep the label human-friendly.
type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export const ENGINE_STATUS_META: Record<EngineStatus, { label: string; tone: Tone }> = {
    DRAFT: { label: 'Draft', tone: 'neutral' },
    TEMPLATES_PENDING: { label: 'Templates pending', tone: 'warning' },
    DRY_RUN: { label: 'Dry run', tone: 'info' },
    ACTIVE: { label: 'Active', tone: 'success' },
    PAUSED: { label: 'Paused', tone: 'warning' },
    ARCHIVED: { label: 'Archived', tone: 'neutral' },
};

export const ACTION_STATUS_META: Record<ActionStatus, { label: string; tone: Tone }> = {
    OPEN: { label: 'Open', tone: 'info' },
    ACKED: { label: 'Acknowledged', tone: 'info' },
    DISPATCHING: { label: 'Sending…', tone: 'warning' },
    SENT: { label: 'Sent', tone: 'success' },
    FAILED: { label: 'Failed', tone: 'danger' },
    DONE: { label: 'Done', tone: 'success' },
    DISMISSED: { label: 'Dismissed', tone: 'neutral' },
    EXPIRED: { label: 'Expired', tone: 'neutral' },
    SIMULATED: { label: 'Simulated', tone: 'neutral' },
};

export const PROPOSAL_STATUS_META: Record<ProposalStatus, { label: string; tone: Tone }> = {
    AI_PROPOSED: { label: 'AI proposed', tone: 'info' },
    USER_REVIEW: { label: 'In review', tone: 'warning' },
    USER_APPROVED: { label: 'Approved (you)', tone: 'info' },
    SUBMITTED: { label: 'Submitting to Meta…', tone: 'warning' },
    META_PENDING: { label: 'Awaiting Meta', tone: 'warning' },
    META_APPROVED: { label: 'Live', tone: 'success' },
    META_REJECTED: { label: 'Rejected by Meta', tone: 'danger' },
    META_RECATEGORISED: { label: 'Recategorised', tone: 'warning' },
    SUPERSEDED: { label: 'Superseded', tone: 'neutral' },
    WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
};

export const LANGUAGE_OPTIONS: { label: string; value: EngineLanguage }[] = [
    { label: 'English', value: 'en' },
    { label: 'Hindi', value: 'hi' },
    { label: 'Hinglish (Latin-script Hindi)', value: 'hinglish' },
];

export const CHANNEL_META: Record<ChannelKey, { label: string; supportsAuto: boolean; supportsAutoReply: boolean }> = {
    WHATSAPP: { label: 'WhatsApp', supportsAuto: true, supportsAutoReply: true },
    EMAIL: { label: 'Email', supportsAuto: true, supportsAutoReply: false },
    IN_APP: { label: 'In-app', supportsAuto: true, supportsAutoReply: false },
    AI_CALL: { label: 'AI call', supportsAuto: false, supportsAutoReply: false },
};

export const CHANNEL_ORDER: ChannelKey[] = ['WHATSAPP', 'EMAIL', 'IN_APP', 'AI_CALL'];

export const TEMPLATE_CATEGORY_OPTIONS = [
    { label: 'Marketing', value: 'MARKETING' },
    { label: 'Utility', value: 'UTILITY' },
    { label: 'Authentication', value: 'AUTHENTICATION' },
];

/** Statuses that count as usable/live for the activation gate (mirrors backend findApproved). */
export const APPROVED_PROPOSAL_STATUSES: ProposalStatus[] = ['META_APPROVED', 'META_RECATEGORISED'];

/** Which engine statuses the UI lets you move to from a given status. Mirrors backend transition(). */
export const NEXT_STATUSES: Partial<Record<EngineStatus, EngineStatus[]>> = {
    DRAFT: ['DRY_RUN', 'ACTIVE'],
    TEMPLATES_PENDING: ['DRY_RUN', 'ACTIVE'],
    DRY_RUN: ['ACTIVE', 'PAUSED'],
    ACTIVE: ['PAUSED'],
    PAUSED: ['ACTIVE', 'ARCHIVED'],
};
