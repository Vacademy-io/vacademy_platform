import { useQuery } from '@tanstack/react-query';
import { getNotificationSettings } from '@/services/notification-settings';

/**
 * Whether in-app chat is switched on for this institute.
 *
 * Chat is **OFF by default** — the backend refuses every conversation call with
 * 403 `CHAT_DISABLED` until an institute explicitly sets `settings.chat.enabled`.
 * Any surface offering a "Message" action therefore has to ask first, or it hands
 * the user a button that can only ever fail.
 *
 * Fail-closed: `false` while loading and on error, matching off-by-default and the
 * sidebar's own gate. Reuses the shared `['notification-settings']` query, so on a
 * screen that already loaded it this costs nothing.
 */
export function useChatEnabled(): { enabled: boolean; isLoading: boolean } {
    const query = useQuery({
        queryKey: ['notification-settings'],
        queryFn: getNotificationSettings,
        refetchOnWindowFocus: false,
    });
    return {
        enabled: query.data?.settings?.chat?.enabled === true,
        isLoading: query.isLoading,
    };
}
