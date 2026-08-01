import { useEffect, useState } from "react";
import { Preferences } from "@capacitor/preferences";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import LocalStorageUtils from "@/utils/localstorage";
import {
  generateCertificateWithCache,
  getCachedCertificateStatus,
} from "@/services/certificates";
import { getStudentDisplaySettings } from "@/services/student-display-settings";

type SearchParamsLike = {
  courseId?: string;
  percentageCompleted?: number;
  percentage_completed?: unknown;
};

// percent can come from query param (carried over from the course list)
const readPctFromSearch = (
  searchParams: SearchParamsLike,
): number | undefined => {
  const raw =
    searchParams.percentageCompleted ?? searchParams.percentage_completed;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

// Enhanced multi-burst confetti (professional feel)
const fireCelebrationConfetti = () => {
  try {
    const colors = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]; // design-lint-ignore: confetti effect palette
    const defaults = {
      colors,
      origin: { y: 0.6 },
    } as const;

    function fire(
      particleRatio: number,
      opts: {
        [K in keyof import("canvas-confetti").Options]?: import("canvas-confetti").Options[K];
      } = {},
    ) {
      confetti({
        ...defaults,
        particleCount: Math.floor(220 * particleRatio),
        ...opts,
      });
    }

    // Central bursts
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.9,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
    fire(0.1, { spread: 120, startVelocity: 45 });

    // Side cannons
    confetti({
      ...defaults,
      particleCount: 60,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      gravity: 0.9,
    });
    confetti({
      ...defaults,
      particleCount: 60,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      gravity: 0.9,
    });

    // Subtle fireworks loop for 2s
    const end = Date.now() + 2000;
    (function frame() {
      confetti({
        ...defaults,
        particleCount: 3,
        startVelocity: 40,
        ticks: 60,
        origin: {
          x: Math.random(),
          y: Math.random() * 0.4 + 0.2,
        },
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  } catch {
    // Confetti error handling
  }
};

// Owns the completion percentage shown on the page and the
// certificate-generation flow (threshold gate, cached certificate display,
// one-time confetti celebration, backend re-confirmation).
export function useCertificateGeneration({
  packageSessionIdForCurrentLevel,
  courseDetailsData,
  searchParams,
}: {
  packageSessionIdForCurrentLevel: string | null;
  courseDetailsData: unknown;
  searchParams: SearchParamsLike;
}) {
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [certificateDialogOpen, setCertificateDialogOpen] =
    useState<boolean>(false);
  const [completionPercentage, setCompletionPercentage] = useState<number>(0);
  const [certificateThreshold, setCertificateThreshold] = useState<number>(80);

  const pctFromCourse = (
    courseDetailsData as
      | { course?: { percentage_completed?: number } }
      | null
      | undefined
  )?.course?.percentage_completed;

  // Update completion percentage when course details data changes
  useEffect(() => {
    if (pctFromCourse) {
      setCompletionPercentage(pctFromCourse);
    }
  }, [courseDetailsData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update completion percentage from query parameters
  useEffect(() => {
    const pctFromQuery = readPctFromSearch(searchParams);
    if (typeof pctFromQuery === "number") {
      setCompletionPercentage(pctFromQuery);
    }
  }, [searchParams]);

  // Trigger certificate generation after entering this page once essentials are available
  useEffect(() => {
    const tryGenerateCertificate = async () => {
      let settings;
      try {
        settings = await getStudentDisplaySettings(false);
      } catch {
        // If we can't fetch settings, assume certificate generation is disabled
        return;
      }

      if (!settings.certificates?.enabled) {
        return;
      }

      try {
        const threshold =
          settings.certificates?.generationThresholdPercent ?? 80;
        setCertificateThreshold(threshold);
        const pctFromQuery = readPctFromSearch(searchParams);
        const pctFromLocal = (() => {
          const key = `COURSE_PCT_${searchParams.courseId}`;
          const saved = LocalStorageUtils.get<{
            value: number;
            ts: number;
          }>(key);
          return saved?.value;
        })();
        // Backend (course-init) is authoritative — URL/localStorage are stale-prone
        // fallbacks for cases where the backend response is unavailable.
        const percentageCompleted =
          typeof pctFromCourse === "number"
            ? pctFromCourse
            : typeof pctFromQuery === "number" && !Number.isNaN(pctFromQuery)
              ? pctFromQuery
              : typeof pctFromLocal === "number"
                ? pctFromLocal
                : undefined;

        if (typeof percentageCompleted === "number") {
          setCompletionPercentage(percentageCompleted);
        }
        const userDetailsRaw = await Preferences.get({
          key: "StudentDetails",
        });
        const user = userDetailsRaw.value
          ? JSON.parse(userDetailsRaw.value)
          : null;
        const userId: string | null = user?.user_id || user?.id || null;

        if (!userId || !packageSessionIdForCurrentLevel) return;

        // Always surface cached certificate if present
        const cached = getCachedCertificateStatus(
          userId,
          packageSessionIdForCurrentLevel,
        );
        if (cached?.url) {
          setCertificateUrl(cached.url);
        }

        if (percentageCompleted == null) return;

        if (
          typeof percentageCompleted === "number" &&
          percentageCompleted >= threshold
        ) {
          const celebrationKey = `CERTIFICATE_CELEBRATED_${userId}_${packageSessionIdForCurrentLevel}`;
          const alreadyCelebrated =
            !!LocalStorageUtils.get<boolean>(celebrationKey);

          const res = await generateCertificateWithCache(
            {
              user_id: userId,
              package_session_id: packageSessionIdForCurrentLevel,
              // Required by the backend eligibility gate: a fresh render returns
              // no certificate when the percentage is missing/below threshold.
              // course_name is intentionally omitted here — the backend falls
              // back to the package name (the authoritative course title).
              completion_percentage: percentageCompleted,
            },
            // Confirm with the backend instead of trusting the 3-hour local
            // cache: the instant-display above (getCachedCertificateStatus)
            // already painted any cached URL, but the backend is the source of
            // truth for the *current* template. Repeat calls are cheap because
            // the backend returns its own cached file id (202) when present and
            // only re-renders after an admin saves new certificate settings.
            { bypassCache: true },
          );

          setCertificateUrl(res.url || null);

          if (res.status === 200 && !alreadyCelebrated) {
            fireCelebrationConfetti();
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
            setTimeout(() => setCertificateDialogOpen(true), 3200);
            toast.success("Certificate generated successfully!", {
              description: "You can now view your certificate.",
            });
            // Mark celebration as shown to avoid repeating confetti on future visits
            LocalStorageUtils.set(celebrationKey, true);
          }
        }
      } catch (error) {
        // Since we already checked that certificate generation is enabled above,
        // we can safely show the error toast

        // Handle specific error types for better user experience
        if (error instanceof Error && error.message.includes("404")) {
          // Don't show error toast for 404 - this suggests the API endpoint is not configured
          return;
        }

        toast.error("Failed to generate certificate. Please try again later.");
      }
    };

    // Only attempt after we have course data and package session id
    if (packageSessionIdForCurrentLevel && courseDetailsData) {
      tryGenerateCertificate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    packageSessionIdForCurrentLevel,
    courseDetailsData,
    searchParams.percentageCompleted,
  ]);

  return {
    certificateUrl,
    showConfetti,
    certificateDialogOpen,
    setCertificateDialogOpen,
    completionPercentage,
    certificateThreshold,
  };
}
