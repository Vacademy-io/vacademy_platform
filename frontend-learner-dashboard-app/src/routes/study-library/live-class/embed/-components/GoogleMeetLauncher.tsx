import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

import { Button } from "@/components/ui/button";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "@/constants/urls";

interface Props {
  scheduleId: string;
  /** meetingUri stored on the session — used if the authenticated resolve fails. */
  fallbackUrl?: string | null;
}

/**
 * Google Meet has no embeddable SDK, so learners join by opening the meetingUri. This mirrors
 * the BBB url-join card: it resolves the join URL via the authenticated
 * /google-meet-join endpoint (which also records attendance at this touchpoint), then opens
 * Meet in a new tab (web) or the Meet app (native, via Capacitor Browser).
 */
export default function GoogleMeetLauncher({ scheduleId, fallbackUrl }: Props) {
  const { t } = useTranslation("studyContent");
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!scheduleId || fetchedRef.current) return;
    fetchedRef.current = true;

    authenticatedAxiosInstance
      .get(`${BASE_URL}/admin-core-service/live-sessions/provider/meeting/google-meet-join`, {
        params: { scheduleId },
      })
      .then((response) => {
        setJoinUrl(response.data?.joinUrl ?? fallbackUrl ?? null);
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          // Not enrolled / cross-institute. Do NOT fall back to the raw link — that would bypass
          // the server-side authorization (and attendance) check. Surface access-denied instead.
          setAccessDenied(true);
        } else if (status === 409) {
          // Meet space still being provisioned — leave joinUrl null → "still being set up" state.
        } else {
          // Network / 5xx only — fall back to the stored link if we have one.
          console.error("Failed to get Google Meet join URL:", err);
          if (fallbackUrl) {
            setJoinUrl(fallbackUrl);
          } else {
            toast.error(t("liveClass.failedToJoinMeeting"));
            fetchedRef.current = false; // allow retry
          }
        }
      })
      .finally(() => setLoading(false));
  }, [scheduleId, fallbackUrl]);

  const openMeeting = (url: string) => {
    if (Capacitor.isNativePlatform()) {
      Browser.open({ url, presentationStyle: "fullscreen" });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <DashboardLoader />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {t("liveClass.noAccessToSession")}
      </div>
    );
  }

  if (!joinUrl) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
        {t("liveClass.meetBeingSetUp")}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8">
      <div className="space-y-3 text-center">
        <h3 className="text-lg font-semibold">{t("liveClass.meetReady")}</h3>
        <p className="text-sm text-muted-foreground">
          {Capacitor.getPlatform() === "web"
            ? t("liveClass.meetClickToJoin")
            : t("liveClass.meetTapToJoin")}
        </p>
        <Button onClick={() => openMeeting(joinUrl)} className="gap-2">
          <ArrowSquareOut size={18} />
          {t("liveClass.joinGoogleMeet")}
        </Button>
      </div>
    </div>
  );
}
