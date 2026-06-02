import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLauncher } from "@capacitor/app-launcher";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { toast } from "sonner";

import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { ZOOM_JOIN_PAYLOAD_ENDPOINT } from "@/constants/urls";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { Button } from "@/components/ui/button";

/**
 * Universal Zoom join — handles desktop web, Capacitor iOS, Capacitor Android.
 *
 * - Native: try the {@code zoommtg://} deep link first (opens Zoom app); fall
 *   back to the Zoom web client inside a Capacitor in-app browser.
 * - Desktop web: deep-link probe is a no-op (AppLauncher isn't implemented on
 *   the web platform), so we go straight to Browser.open which becomes
 *   window.open and opens the Zoom Web Client in a new tab. We previously
 *   tried to embed via the Web Meeting SDK Component View here, but the SDK
 *   reads React 17/18 internals (ReactCurrentOwner, ReactDOM.render,
 *   ReactDOM.createRoot from the default export) that React 19 removed — so
 *   it crashes on mount. Hosted Web Client sidesteps the React conflict
 *   entirely and Zoom keeps the join seamless via URL-baked credentials.
 *
 * AppLauncher.canOpenUrl gives a definitive installed/not-installed answer (no
 * timeout guessing), but it requires the zoommtg/zoomus schemes to be declared in
 * the iOS Info.plist LSApplicationQueriesSchemes.
 */

interface ZoomJoinPayload {
    meetingNumber: string;
    passcode: string;
    userName: string;
    deepLink: string;
    webFallback: string;
}

export default function ZoomNativeLauncher({ scheduleId }: { scheduleId: string }) {
    const [launching, setLaunching] = useState(false);
    const autoTriedRef = useRef(false);

    const { data, isLoading, error } = useQuery<ZoomJoinPayload>({
        queryKey: ["zoom-join-payload", scheduleId],
        queryFn: async () => {
            const res = await authenticatedAxiosInstance.get(ZOOM_JOIN_PAYLOAD_ENDPOINT, {
                params: { scheduleId },
            });
            return res.data;
        },
        staleTime: 60 * 1000,
        retry: 1,
    });

    const launch = useCallback(async () => {
        if (!data) return;
        setLaunching(true);
        try {
            let opened = false;
            try {
                const { value } = await AppLauncher.canOpenUrl({ url: "zoommtg://" });
                if (value) {
                    await AppLauncher.openUrl({ url: data.deepLink });
                    opened = true;
                }
            } catch {
                // canOpenUrl/openUrl can throw if the scheme isn't declared — fall through.
                opened = false;
            }

            if (!opened) {
                // Zoom app not installed (or scheme not queryable) → web client.
                await Browser.open({ url: data.webFallback, presentationStyle: "fullscreen" });
            }
        } catch (e) {
            console.error("[Zoom native] launch failed:", e);
            toast.error("Could not open the Zoom meeting. Please try again.");
        } finally {
            setLaunching(false);
        }
    }, [data]);

    // Auto-attempt once when the payload is ready, so the common case is one tap
    // (the navigation into this page) rather than two.
    useEffect(() => {
        if (data && !autoTriedRef.current) {
            autoTriedRef.current = true;
            void launch();
        }
    }, [data, launch]);

    if (isLoading) return <DashboardLoader />;

    if (error) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-red-600">Failed to prepare the Zoom meeting.</p>
                <p className="text-sm text-neutral-500">Please refresh and try again.</p>
            </div>
        );
    }

    const isWeb = !Capacitor.isNativePlatform();
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8">
            <div className="space-y-3 text-center">
                <h3 className="text-lg font-semibold">Live Class is Ready</h3>
                <p className="text-sm text-muted-foreground">
                    {isWeb
                        ? "Opening the Zoom meeting in a new tab. If your browser blocked the popup, click below to open it manually."
                        : "Opening Zoom… if it doesn’t open automatically, tap below."}
                </p>
                <Button onClick={() => void launch()} disabled={launching} className="gap-2">
                    <ArrowSquareOut size={18} />
                    {launching ? "Opening…" : isWeb ? "Open Zoom Meeting" : "Join Live Class"}
                </Button>
            </div>
        </div>
    );
}
