/**
 * Wording for the Message action when in-app chat is off.
 *
 * In-App Messages is OFF until an institute switches it on (Settings → Notifications),
 * and until then every conversation call is refused with 403 CHAT_DISABLED.
 *
 * Staff see the action DISABLED with this explanation rather than hidden: an admin or
 * mentor is exactly who can turn the setting on, so a missing button is a dead end —
 * they'd conclude mentorship messaging doesn't exist. Learners get it hidden instead,
 * because nothing in the answer is actionable for them.
 */
export const CHAT_OFF_REASON =
    'In-App Messages is off for this institute. Turn it on in Settings → Notifications to message from here.';

/** Tooltip for the Message action, naming the blocker when there is one. */
export function messageActionTitle(chatEnabled: boolean): string {
    return chatEnabled ? 'Send this student a direct message' : CHAT_OFF_REASON;
}

/** Where an admin goes to switch In-App Messages on. */
export const CHAT_SETTINGS_LINK = {
    to: '/settings',
    search: { selectedTab: 'notification' },
} as const;
