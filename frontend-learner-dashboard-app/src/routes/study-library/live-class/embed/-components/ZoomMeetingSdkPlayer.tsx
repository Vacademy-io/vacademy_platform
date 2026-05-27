import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { ZOOM_SDK_SIGNATURE_ENDPOINT } from "@/constants/urls";
import { DashboardLoader } from "@/components/core/dashboard-loader";

/**
 * Embeds a live Zoom meeting using the Web Meeting SDK (Component View) loaded
 * from Zoom's CDN — NOT the `@zoom/meetingsdk` npm package.
 *
 * Why the CDN: the learner app is on React 19, which removed several React 17/18
 * internals the npm-imported SDK reads (ReactCurrentOwner, ReactDOM.render,
 * ReactDOM.createRoot from the default export). Zoom publishes the SDK plus its
 * own React 18 build as separate scripts; loading them in order gives the SDK
 * its own React on window.* without touching the host app's ESM React imports.
 *
 * Load order matters — the SDK bundle is built with React/ReactDOM as webpack
 * "externals" (it does `e.exports = React` / `= ReactDOM`), so those globals
 * MUST exist before the SDK script runs or its module graph fails to init and
 * window.ZoomMtgEmbedded never gets assigned.
 *
 * Flow: load React → ReactDOM → SDK once per page, fetch a signed signature
 * from the backend, then call init/join on the window.ZoomMtgEmbedded global
 * with name and passcode pre-filled so the learner lands straight in the meeting.
 */

// Pin the SDK version to 3.13.2 — the SAME version the admin dashboard uses
// successfully via npm. 6.0.2 worked at the load level but its Component View
// toolbar visibility differs (auto-hides aggressively, can't be unmuted/joined
// video). Keeping both ends on 3.13.2 means the same SDK behaviour everywhere.
const ZOOM_SDK_VERSION = "3.13.2";
const ZOOM_REACT_SCRIPT = `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/react.min.js`;
const ZOOM_REACT_DOM_SCRIPT = `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/react-dom.min.js`;
const ZOOM_SDK_SCRIPT = `https://source.zoom.us/${ZOOM_SDK_VERSION}/zoom-meeting-embedded-${ZOOM_SDK_VERSION}.min.js`;
const ZOOM_SDK_CSS = `https://source.zoom.us/${ZOOM_SDK_VERSION}/css/bootstrap.css`;

// Loose typing — the SDK's runtime shape varies across minor versions and we
// don't get TS types from a script tag anyway. eslint disables stay scoped here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZoomMtgEmbeddedGlobal = any;

declare global {
    interface Window {
        ZoomMtgEmbedded?: ZoomMtgEmbeddedGlobal;
    }
}

/** Insert a <script src> exactly once (idempotent on re-mount) and resolve when
 * it has finished executing. The data-attribute key dedupes concurrent mounts. */
function loadScriptOnce(src: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[data-zoom-cdn="${key}"]`);
        if (existing) {
            if (existing.dataset.loaded === "true") return resolve();
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = false; // preserve order across consecutive appends
        script.setAttribute("data-zoom-cdn", key);
        script.onload = () => {
            script.dataset.loaded = "true";
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
        // CSS (non-blocking, fire-and-forget).
        if (!document.querySelector(`link[data-zoom-sdk-css="${ZOOM_SDK_VERSION}"]`)) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = ZOOM_SDK_CSS;
            link.setAttribute("data-zoom-sdk-css", ZOOM_SDK_VERSION);
            document.head.appendChild(link);
        }
        // React → ReactDOM → SDK, in strict order. The SDK bundle reads them
        // as globals at module-init time; reversing the order silently breaks
        // window.ZoomMtgEmbedded assignment.
        try {
            await loadScriptOnce(ZOOM_REACT_SCRIPT, `react-${ZOOM_SDK_VERSION}`);
            await loadScriptOnce(ZOOM_REACT_DOM_SCRIPT, `react-dom-${ZOOM_SDK_VERSION}`);
            await loadScriptOnce(ZOOM_SDK_SCRIPT, `sdk-${ZOOM_SDK_VERSION}`);
        } catch (e) {
            sdkLoadPromise = null; // allow retry on next mount
            throw e;
        }
        if (!window.ZoomMtgEmbedded) {
            sdkLoadPromise = null;
            throw new Error(
                "Zoom SDK loaded but window.ZoomMtgEmbedded is missing — vendor React/ReactDOM globals may have failed to initialize"
            );
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

type Phase = "loading" | "joining" | "joined" | "error";

export default function ZoomMeetingSdkPlayer({ scheduleId }: { scheduleId: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientRef = useRef<any>(null);
    const [phase, setPhase] = useState<Phase>("loading");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const { data, error } = useQuery<ZoomSdkSignature>({
        queryKey: ["zoom-sdk-signature", scheduleId],
        queryFn: async () => {
            const res = await authenticatedAxiosInstance.get(ZOOM_SDK_SIGNATURE_ENDPOINT, {
                params: { scheduleId, role: 0 },
            });
            return res.data;
        },
        // Signature is valid ~2h; refetch generously before that.
        staleTime: 60 * 1000,
        retry: 1,
    });

    useEffect(() => {
        if (!data || !containerRef.current) return;
        // Guard against React StrictMode double-mount — SDK throws
        // "Duplicated join operation" if join() is called twice.
        if (clientRef.current) return;
        let cancelled = false;

        // The Zoom SDK invokes window.location.reload() in some teardown
        // paths — when our React container unmounts (back button, nav), the
        // SDK fires that reload and blows away the SPA. Neutralize it while
        // the meeting is active; restore on cleanup so the rest of the app
        // behaves normally.
        const originalReload = window.location.reload;
        try {
            Object.defineProperty(window.location, "reload", {
                configurable: true,
                value: function suppressedReload() {
                    // eslint-disable-next-line no-console
                    console.warn("[Zoom Learner] Suppressed SDK location.reload() during active meeting");
                },
            });
        } catch {
            /* best-effort */
        }

        (async () => {
            try {
                setPhase("joining");
                const ZoomMtgEmbedded = await loadZoomSdkFromCdn();
                const client = ZoomMtgEmbedded.createClient();
                clientRef.current = client;

                // 1100×620 is the SDK's safe sweet-spot — bigger than the
                // baked-in default (~500×300), small enough to avoid the
                // off-canvas video-tile bug that kicks in above ~1280×720.
                // leaveOnPageUnload OFF — we tear down explicitly via
                // destroyClient in the unmount cleanup so client-side router
                // navigations don't trigger a hard reload (the SDK's unload
                // handler behaves oddly when the page isn't actually leaving).
                // Compact 400×225 viewSizes — small enough to stay
                // centered in the viewport at 100% browser zoom even
                // if the SDK has a position offset bias. Trade-off is
                // a smaller player but it's functional for the learner.
                const POPPER_W = 400;
                const POPPER_H = 225;
                const POPPER_TOTAL_W = 600;
                const centerLeft = Math.max(0, Math.floor((window.innerWidth - POPPER_TOTAL_W) / 2));
                await client.init({
                    zoomAppRoot: containerRef.current as HTMLElement,
                    language: "en-US",
                    patchJsMedia: true,
                    leaveOnPageUnload: false,
                    customize: {
                        video: {
                            defaultViewType: "speaker",
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
                setPhase("joined");
                // Lock viewSizes via updateVideoOptions to prevent the
                // SDK from resizing the canvas on view-mode changes.
                if (typeof client.updateVideoOptions === "function") {
                    try {
                        client.updateVideoOptions({
                            viewSizes: {
                                default: { width: POPPER_W, height: POPPER_H },
                                ribbon: { width: POPPER_W, height: POPPER_H },
                            },
                        });
                    } catch { /* ignore */ }
                }
            } catch (err: unknown) {
                if (cancelled) return;
                // The SDK error shape varies — some throws carry errorCode +
                // reason, some only a message, some are plain Error objects.
                // Surface whatever we can find rather than a useless "UNKNOWN".
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const e = err as any;
                const code = e?.errorCode ?? e?.type ?? null;
                const reason = e?.reason ?? e?.message ?? (typeof e === "string" ? e : null);
                // Log the full error AND its stack — minified errors like "u is
                // not a function" are useless without the stack to anchor them.
                console.error("[Zoom SDK] join failed — full error object:", err);
                if (e?.stack) console.error("[Zoom SDK] stack:\n" + e.stack);
                const detail = [reason, code != null ? `code ${code}` : null]
                    .filter(Boolean)
                    .join(" · ") || "see console for full error";
                setErrorMsg(`Could not join the Zoom meeting (${detail}).`);
                setPhase("error");
            }
        })();

        return () => {
            cancelled = true;
            // Don't null clientRef — it's the duplicate-join guard. The
            // SDK rejects a second join() call with "Duplicated join
            // operation". Refs persist across StrictMode re-mounts so
            // keeping it set blocks the second init path.
            // Restore real reload for the rest of the app.
            try {
                Object.defineProperty(window.location, "reload", {
                    configurable: true,
                    value: originalReload,
                });
            } catch {
                /* ignore */
            }
        };
    }, [data]);

    // No speaker-tab click for learner. Zoom's Component View only
    // renders minimize + gallery tabs for non-host participants — the
    // Speaker tab doesn't exist in the learner UI. Whatever view Zoom
    // defaults to (typically gallery when 2+ participants) is what the
    // learner gets. The host's view selection (speaker, on the admin
    // side) drives the active-speaker indicator anyway.

    if (error || phase === "error") {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-red-600">
                    {errorMsg ?? "Failed to load the Zoom meeting."}
                </p>
                <p className="text-sm text-neutral-500">
                    Please refresh the page or try rejoining.
                </p>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full bg-black">
            {/* Reset Zoom's forced min-width on html/body (causes popper
                to push past center) and hide the orphan #zmmtg-root.
                These two rules are the entire "Khawaja Mushood" working
                pattern for Component View positioning. */}
            <style>{`
                #zmmtg-root { display: none !important; }
                html, body { min-width: 0 !important; }
            `}</style>
            <div ref={containerRef} className="absolute inset-0" />
            {phase !== "joined" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="flex flex-col items-center gap-3 text-white">
                        <DashboardLoader />
                        <span className="text-sm">
                            {phase === "loading" ? "Preparing meeting…" : "Joining meeting…"}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
