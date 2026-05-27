import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ZOOM_SDK_SIGNATURE_ENDPOINT } from '@/constants/urls';

/**
 * Embeds a Zoom meeting as host using the Web Meeting SDK (Component View),
 * loaded from Zoom's CDN — same pattern as the learner player. Loading via
 * the CDN (instead of the npm package) isolates the SDK's React tree from
 * our app's React tree, which matters here because the SDK installs
 * window-level event handlers (visibilitychange/focus/blur) that interfere
 * with TanStack Router's SPA navigation. With the CDN-loaded SDK using its
 * own bundled React 18, those handlers can be intercepted cleanly before
 * the SDK init code runs.
 *
 * Joins with role=1 + ZAK token so the host starts the meeting directly
 * inside the embed (not bounced to Zoom's hosted start_url page).
 */

// Pin the SDK version. Both admin and learner load 3.13.2 from the same CDN
// so the in-meeting UI behaviour is identical end-to-end.
const ZOOM_SDK_VERSION = '3.13.2';
const ZOOM_REACT_SCRIPT = `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/react.min.js`;
const ZOOM_REACT_DOM_SCRIPT = `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/react-dom.min.js`;
const ZOOM_SDK_SCRIPT = `https://source.zoom.us/${ZOOM_SDK_VERSION}/zoom-meeting-embedded-${ZOOM_SDK_VERSION}.min.js`;
const ZOOM_SDK_CSS = `https://source.zoom.us/${ZOOM_SDK_VERSION}/css/bootstrap.css`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZoomMtgEmbeddedGlobal = any;

declare global {
    interface Window {
        ZoomMtgEmbedded?: ZoomMtgEmbeddedGlobal;
    }
}

/** Idempotent <script src> insertion with order-preserving load. */
function loadScriptOnce(src: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[data-zoom-cdn="${key}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') return resolve();
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.setAttribute('data-zoom-cdn', key);
        script.onload = () => {
            script.dataset.loaded = 'true';
            resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
    });
}

let sdkLoadPromise: Promise<ZoomMtgEmbeddedGlobal> | null = null;

function loadZoomSdkFromCdn(): Promise<ZoomMtgEmbeddedGlobal> {
    if (window.ZoomMtgEmbedded) return Promise.resolve(window.ZoomMtgEmbedded);
    if (sdkLoadPromise) return sdkLoadPromise;
    sdkLoadPromise = (async () => {
        if (!document.querySelector(`link[data-zoom-sdk-css="${ZOOM_SDK_VERSION}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = ZOOM_SDK_CSS;
            link.setAttribute('data-zoom-sdk-css', ZOOM_SDK_VERSION);
            document.head.appendChild(link);
        }
        try {
            await loadScriptOnce(ZOOM_REACT_SCRIPT, `react-${ZOOM_SDK_VERSION}`);
            await loadScriptOnce(ZOOM_REACT_DOM_SCRIPT, `react-dom-${ZOOM_SDK_VERSION}`);
            await loadScriptOnce(ZOOM_SDK_SCRIPT, `sdk-${ZOOM_SDK_VERSION}`);
        } catch (e) {
            sdkLoadPromise = null;
            throw e;
        }
        if (!window.ZoomMtgEmbedded) {
            sdkLoadPromise = null;
            throw new Error('Zoom SDK loaded but window.ZoomMtgEmbedded is missing');
        }
        return window.ZoomMtgEmbedded;
    })();
    return sdkLoadPromise;
}
interface ZoomSdkSignature {
    signature: string;
    sdkKey: string;
    meetingNumber: string;
    passcode: string;
    userName: string;
    userEmail?: string;
    role: number;
    zakToken?: string | null;
    tokenExp: number;
}

type Phase = 'loading' | 'joining' | 'joined' | 'error';

export default function ZoomHostSdkPlayer({ scheduleId }: { scheduleId: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientRef = useRef<any>(null);
    // Captured at init so the unmount cleanup can call destroyClient without
    // re-awaiting the dynamic import.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdkRef = useRef<any>(null);
    const [phase, setPhase] = useState<Phase>('loading');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const { data, error } = useQuery<ZoomSdkSignature>({
        queryKey: ['zoom-host-sdk-signature', scheduleId],
        queryFn: async () => {
            const res = await authenticatedAxiosInstance.get(ZOOM_SDK_SIGNATURE_ENDPOINT, {
                params: { scheduleId, role: 1 },
            });
            return res.data;
        },
        staleTime: 60 * 1000,
        retry: 1,
    });

    useEffect(() => {
        if (!data || !containerRef.current) return;
        // Guard against React StrictMode double-mount (and any future
        // re-fires of this effect) — the SDK throws "Duplicated join
        // operation" if join() is called twice. clientRef persists
        // across re-renders so we use its presence as a "already
        // initialized" signal.
        if (clientRef.current) return;
        let cancelled = false;

        (window as unknown as { __zoomMeetingActive?: boolean }).__zoomMeetingActive = true;

        // The Zoom SDK invokes window.location.reload() in some teardown
        // paths. Override it with a no-op for the duration of the meeting
        // so SDK reconnect logic doesn't kick us out on tab switch.
        // Restored on cleanup. (This is the same pattern that keeps the
        // learner stable on tab switches — admin without it reloads.)
        const originalReload = window.location.reload;
        try {
            Object.defineProperty(window.location, 'reload', {
                configurable: true,
                value: function suppressedReload() {
                    // eslint-disable-next-line no-console
                    console.warn('[Zoom Host] Suppressed SDK location.reload() during active meeting');
                },
            });
        } catch {
            /* some browsers lock location.reload — best-effort */
        }

        (async () => {
            try {
                setPhase('joining');
                const ZoomMtgEmbedded = await loadZoomSdkFromCdn();
                sdkRef.current = ZoomMtgEmbedded;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const client: any = ZoomMtgEmbedded.createClient();
                clientRef.current = client;

                // Compact viewSizes (400×225) — small enough that even
                // if the SDK's anchorPosition computation has an offset
                // bias we can't predict, the popper stays centered-ish
                // and fits inside the viewport at 100% browser zoom.
                // The user explicitly OK'd a small player so long as
                // admin can teach and learner can learn. Empirically
                // the popper renders ~200px wider than viewSizes (chrome:
                // top toolbar + participant strip + bottom toolbar +
                // padding), so total popper width ≈ 600.
                const POPPER_W = 400;
                const POPPER_H = 225;
                const POPPER_TOTAL_W = 600;
                const centerLeft = Math.max(0, Math.floor((window.innerWidth - POPPER_TOTAL_W) / 2));
                await client.init({
                    zoomAppRoot: containerRef.current as HTMLElement,
                    language: 'en-US',
                    patchJsMedia: true,
                    leaveOnPageUnload: false,
                    customize: {
                        video: {
                            defaultViewType: 'speaker',
                            isResizable: false,
                            popper: {
                                disableDraggable: true,
                                anchorPosition: { top: 60, left: centerLeft },
                            },
                            viewSizes: {
                                default: { width: POPPER_W, height: POPPER_H },
                                ribbon: { width: POPPER_W, height: POPPER_H },
                            },
                        },
                    },
                });

                await client.join({
                    signature: data.signature,
                    sdkKey: data.sdkKey,
                    meetingNumber: data.meetingNumber,
                    password: data.passcode,
                    userName: data.userName,
                    userEmail: data.userEmail,
                    // ZAK is what flips this from "join as user" to "start as host".
                    zak: data.zakToken ?? undefined,
                });

                if (cancelled) {
                    try {
                        await client.leaveMeeting();
                    } catch {
                        /* ignore */
                    }
                    return;
                }
                setPhase('joined');
                // Apply identical viewSizes via updateVideoOptions to lock
                // the size against the SDK's auto-resize on view changes.
                // Per Zoom DevRel: updateVideoOptions accepts viewSizes and
                // induces a re-render at the requested size. This is the
                // only public way to prevent ribbon view from stretching.
                const lockSize = () => {
                    if (typeof client.updateVideoOptions === 'function') {
                        try {
                            client.updateVideoOptions({
                                viewSizes: {
                                    default: { width: POPPER_W, height: POPPER_H },
                                    ribbon: { width: POPPER_W, height: POPPER_H },
                                },
                            });
                        } catch { /* ignore */ }
                    }
                };
                lockSize();
            } catch (err: unknown) {
                if (cancelled) return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const code = (err as any)?.errorCode ?? (err as any)?.reason ?? 'UNKNOWN';
                console.error('[Zoom Host SDK] join failed:', err);
                setErrorMsg(`Could not start the Zoom meeting (${code}).`);
                setPhase('error');
            }
        })();

        return () => {
            cancelled = true;
            // Don't null clientRef/sdkRef on cleanup — those refs are the
            // duplicate-join guard. Resetting them lets React StrictMode's
            // remount call init() + join() again, which the SDK rejects
            // with "Duplicated join operation". The actual SDK teardown
            // happens when the page truly unloads (real navigation).
            // Restore real reload for the rest of the app.
            try {
                Object.defineProperty(window.location, 'reload', {
                    configurable: true,
                    value: originalReload,
                });
            } catch {
                /* ignore */
            }
            (window as unknown as { __zoomMeetingActive?: boolean }).__zoomMeetingActive = false;
        };
    }, [data]);

    // Force speaker view. Retry clicking for ~10s with multiple fallback
    // selectors (tab IDs vary between host/participant). Bounded — stops
    // after 40 attempts.
    useEffect(() => {
        if (phase !== 'joined') return;
        let attempts = 0;
        const MAX_ATTEMPTS = 40;
        const findSpeakerTab = (): HTMLElement | null =>
            document.getElementById('suspension-view-tab-thumbnail-speaker') ||
            document.querySelector<HTMLElement>('[aria-label="thumbnail-speaker"]') ||
            document.querySelector<HTMLElement>('button[role="tab"][title="Speaker"]');
        const interval = window.setInterval(() => {
            attempts += 1;
            const tab = findSpeakerTab();
            if (tab && tab.getAttribute('aria-selected') !== 'true') {
                tab.click();
            }
            if (attempts >= MAX_ATTEMPTS) window.clearInterval(interval);
        }, 250);
        return () => window.clearInterval(interval);
    }, [phase]);

    if (error || phase === 'error') {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-red-600">
                    {errorMsg ?? 'Failed to start the Zoom meeting.'}
                </p>
                <p className="text-sm text-neutral-500">
                    Please refresh the page or try again.
                </p>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full bg-black">
            {/* Reset Zoom's forced min-width on html/body and hide the
                orphan #zmmtg-root the SDK leaves behind. Without these,
                the body gets a min-width that pushes the popper off
                center. From the only publicly-known working integration
                (Khawaja Mushood's React+Vite walkthrough). */}
            <style>{`
                #zmmtg-root { display: none !important; }
                html, body { min-width: 0 !important; }
            `}</style>
            <div ref={containerRef} className="absolute inset-0" />
            {phase !== 'joined' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="flex flex-col items-center gap-3 text-white">
                        <div className="size-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span className="text-sm">
                            {phase === 'loading' ? 'Preparing meeting…' : 'Starting meeting as host…'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
