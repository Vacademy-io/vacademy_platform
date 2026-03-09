export enum SessionStatus {
    LIVE = 'Live',
    UPCOMING = 'Upcoming',
    PAST = 'Past',
    DRAFTS = 'Drafts',
}
export enum RecurringType {
    ONCE = 'once',
    WEEKLY = 'weekly',
    MONTHLY = 'monthly',
}
export enum AccessType {
    PUBLIC = 'public',
    PRIVATE = 'private',
}
export enum InputType {
    TEXT = 'text',
    DROPDOWN = 'dropdown',
}
export const sessionStatusLabels: Record<SessionStatus, string> = {
    [SessionStatus.UPCOMING]: 'Upcoming',
    [SessionStatus.PAST]: 'Past',
    [SessionStatus.DRAFTS]: 'Drafts',
    [SessionStatus.LIVE]: 'Live',
};
export enum SessionType {
    LIVE = 'live',
    PRE_RECORDED = 'pre-recorded',
}
export enum SessionPlatform {
    EMBED_IN_APP = 'embed',
    REDIRECT_TO_OTHER_PLATFORM = 'redirect',
}
export enum StreamingPlatform {
    YOUTUBE = 'youtube',
    MEET = 'google meet',
    ZOOM = 'zoom',
    ZOHO = 'zoho',
    OTHER = 'other',
}
