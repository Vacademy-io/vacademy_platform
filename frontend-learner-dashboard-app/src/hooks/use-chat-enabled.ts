import { useEffect, useState } from "react";
import { getChatEnabled } from "@/services/chat/getChatEnabled";

/**
 * Whether in-app chat is switched on for this institute.
 *
 * Chat is **OFF by default** — the backend refuses every conversation call with
 * 403 `CHAT_DISABLED` until an institute explicitly sets `settings.chat.enabled`.
 * A "Message" button shown without this check can only ever fail.
 *
 * Fail-closed: `false` until the answer arrives, matching off-by-default and the
 * sidebar's own gate. `getChatEnabled` caches per institute, so repeat callers on
 * the same screen don't refetch.
 */
export function useChatEnabled(): { enabled: boolean; isLoading: boolean } {
    const [enabled, setEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        getChatEnabled()
            .then((value) => {
                if (active) setEnabled(value);
            })
            // getChatEnabled already fails closed; this only guards an unmounted set.
            .catch(() => undefined)
            .finally(() => {
                if (active) setIsLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    return { enabled, isLoading };
}
