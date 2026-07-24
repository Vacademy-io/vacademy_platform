import { CHANNEL_META, CHANNEL_ORDER } from '../-constants';
import type { ChannelKey, ChannelsConfig, EngagementEngine } from '../-types';

export function safeParse<T>(raw: string | undefined | null, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function enabledChannels(engine: Pick<EngagementEngine, 'channels'>): ChannelKey[] {
    const cfg = safeParse<ChannelsConfig>(engine.channels, {});
    return CHANNEL_ORDER.filter((c) => cfg[c]?.enabled);
}

export function channelLabels(engine: Pick<EngagementEngine, 'channels'>): string[] {
    return enabledChannels(engine).map((c) => CHANNEL_META[c].label);
}

export function whatsappEnabled(engine: Pick<EngagementEngine, 'channels'>): boolean {
    return safeParse<ChannelsConfig>(engine.channels, {}).WHATSAPP?.enabled === true;
}

/**
 * Channels the engine actually auto-sends on: BOTH enabled AND auto (mirrors the backend, which
 * never picks a non-enabled channel — so a stale {enabled:false,auto:true} must not count).
 */
export function autoSendChannels(engine: Pick<EngagementEngine, 'channels'>): ChannelKey[] {
    const cfg = safeParse<ChannelsConfig>(engine.channels, {});
    return CHANNEL_ORDER.filter((c) => cfg[c]?.enabled && cfg[c]?.auto);
}

export function formatDateTime(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
