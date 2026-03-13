import { useEffect, useRef, useCallback, useState } from "react";
import { ZohoMeetingConfig, ZohoMeetingState, IZohoMeetingStrategy } from "./types";
import { ZohoIframeStrategy } from "./ZohoIframeStrategy";

/**
 * Ordered list of strategies to try.
 * Zoho Meeting uses iframe-based embedding only — there is no public Zoho JS SDK.
 * Additional strategies can be added here when/if Zoho publishes one.
 */
const STRATEGY_CHAIN: IZohoMeetingStrategy[] = [
    new ZohoIframeStrategy(),
];

/**
 * Hook that mounts a Zoho meeting into `containerRef` using the first supported strategy.
 * Automatically unmounts on component teardown.
 */
export function useZohoMeeting(
    containerRef: React.RefObject<HTMLElement | null>,
    config: ZohoMeetingConfig | null
) {
    const [state, setState] = useState<ZohoMeetingState>({
        status: "idle",
        error: null,
        activeStrategy: null,
    });

    const activeStrategyRef = useRef<IZohoMeetingStrategy | null>(null);
    // Track the config key so we don't remount for the same meeting
    const configKeyRef = useRef<string | null>(null);

    const mount = useCallback(async (container: HTMLElement, cfg: ZohoMeetingConfig) => {
        setState({ status: "loading", error: null, activeStrategy: null });

        for (const strategy of STRATEGY_CHAIN) {
            if (!strategy.isSupported()) continue;

            try {
                await strategy.mount(container, cfg);
                activeStrategyRef.current = strategy;
                setState({ status: "ready", error: null, activeStrategy: strategy.name });
                return;
            } catch (err) {
                console.warn(`[ZohoMeeting] Strategy '${strategy.name}' failed:`, err);
                strategy.unmount(); // clean up any partial DOM
            }
        }

        setState({
            status: "error",
            error: "All Zoho meeting strategies failed. See console for details.",
            activeStrategy: null,
        });
    }, []);

    useEffect(() => {
        if (!config || !containerRef.current) return;

        const configKey = `${config.meetingKey}:${config.tld}:${config.embedToken}`;

        // Avoid remounting for the same config
        if (configKey === configKeyRef.current) return;
        configKeyRef.current = configKey;

        // Unmount any previous strategy before mounting a new one
        if (activeStrategyRef.current) {
            activeStrategyRef.current.unmount();
            activeStrategyRef.current = null;
        }

        mount(containerRef.current, config);

        return () => {
            activeStrategyRef.current?.unmount();
            activeStrategyRef.current = null;
            configKeyRef.current = null;
        };
    }, [config, containerRef, mount]);

    return state;
}
