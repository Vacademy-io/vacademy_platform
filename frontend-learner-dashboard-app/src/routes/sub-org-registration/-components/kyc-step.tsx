import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  IdentificationCard,
  ShieldCheck,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { ModernCard } from "@/components/design-system/modern-card";
import { MyButton } from "@/components/design-system/button";
import { Separator } from "@/components/ui/separator";
import type {
  KycStatus,
  KycSummary,
} from "../-services/sub-org-registration-services";
import {
  startKyc,
  getKycStatus,
  getSubOrgApiErrorMessage,
} from "../-services/sub-org-registration-services";

const POLL_INTERVAL_MS = 4000;

type KycUiState = "CHECKING" | "INTRO" | "WAITING" | "VERIFIED" | "FAILED";

const FAILURE_MESSAGES: Record<string, string> = {
  CONSENT_DENIED:
    "DigiLocker consent was denied. To verify your identity, please try again and approve access to your documents.",
  EXPIRED:
    "The verification link expired before it was completed. Start a new verification to continue.",
  FAILED: "We couldn't verify your identity. Please try again.",
};

const isTerminalFailure = (
  status: KycStatus
): status is "CONSENT_DENIED" | "EXPIRED" | "FAILED" =>
  status === "CONSENT_DENIED" || status === "EXPIRED" || status === "FAILED";

interface KycStepProps {
  registrationId: string | null;
  /** Template's kyc_documents — e.g. ["AADHAAR"] or ["AADHAAR","PAN"]. */
  kycDocuments?: string[] | null;
  /** Final post-OTP step — Continue submits the registration. */
  isFinalStep: boolean;
  /** Wizard is running /complete after this step. */
  isSubmitting: boolean;
  onContinue: () => Promise<void> | void;
  onSessionMissing: () => void;
}

/**
 * KYC step — verifies the org admin's identity via DigiLocker. Mints the
 * consent URL on button click (it expires in ~10 minutes), opens it in a new
 * tab, then polls /kyc/status every 4s until VERIFIED or a terminal failure.
 * Continue is gated on VERIFIED so /complete never 4xxs on a skipped KYC.
 */
const KycStep = ({
  registrationId,
  kycDocuments,
  isFinalStep,
  isSubmitting,
  onContinue,
  onSessionMissing,
}: KycStepProps) => {
  const [uiState, setUiState] = useState<KycUiState>("CHECKING");
  const [summary, setSummary] = useState<KycSummary | null>(null);
  const [failureStatus, setFailureStatus] = useState<string | null>(null);
  const [isStartingKyc, setIsStartingKyc] = useState(false);
  /** Consent URL shown as a link when window.open was popup-blocked. */
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  const requiredDocuments = (kycDocuments ?? []).map((doc) =>
    String(doc).toUpperCase()
  );
  const requiresPan = requiredDocuments.includes("PAN");

  // One status fetch on mount: a user who refreshed after verifying jumps
  // straight to the success state without minting a fresh consent URL.
  const didInitialCheckRef = useRef(false);
  useEffect(() => {
    if (didInitialCheckRef.current) return;
    didInitialCheckRef.current = true;

    if (!registrationId) {
      toast.error("Registration session missing. Please start again");
      onSessionMissing();
      return;
    }

    let cancelled = false;
    const checkExistingStatus = async () => {
      try {
        const response = await getKycStatus(registrationId);
        if (cancelled) return;
        if (response.kyc_status === "VERIFIED") {
          setSummary(response.summary ?? null);
          setUiState("VERIFIED");
        } else {
          setUiState("INTRO");
        }
      } catch {
        // Status probe is best-effort — fall back to the intro state.
        if (!cancelled) setUiState("INTRO");
      }
    };
    void checkExistingStatus();
    return () => {
      cancelled = true;
    };
  }, [registrationId, onSessionMissing]);

  // Poll while waiting for the user to finish in the DigiLocker tab. The
  // cleanup clears the interval on unmount and whenever uiState leaves
  // WAITING (i.e. on terminal states).
  useEffect(() => {
    if (uiState !== "WAITING" || !registrationId) return;

    let cancelled = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await getKycStatus(registrationId);
        if (cancelled) return;
        if (response.kyc_status === "VERIFIED") {
          setSummary(response.summary ?? null);
          setUiState("VERIFIED");
        } else if (isTerminalFailure(response.kyc_status)) {
          setFailureStatus(response.kyc_status);
          setUiState("FAILED");
        }
      } catch {
        // Transient poll failures are ignored; the next tick retries.
      } finally {
        inFlight = false;
      }
    };

    const intervalId = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [uiState, registrationId]);

  const handleStartVerification = async () => {
    if (!registrationId) {
      toast.error("Registration session missing. Please start again");
      onSessionMissing();
      return;
    }
    setIsStartingKyc(true);
    setFallbackUrl(null);
    try {
      const response = await startKyc(
        registrationId,
        `${window.location.origin}/kyc-complete`
      );
      // noopener: the DigiLocker tab must not get a handle on this wizard.
      const opened = window.open(response.url, "_blank", "noopener");
      if (!opened) {
        // Popup blocked — surface the consent URL as a clickable link instead.
        setFallbackUrl(response.url);
      }
      setFailureStatus(null);
      setUiState("WAITING");
    } catch (error) {
      toast.error(
        getSubOrgApiErrorMessage(
          error,
          "Failed to start identity verification. Please try again"
        )
      );
    } finally {
      setIsStartingKyc(false);
    }
  };

  const documentChips = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-caption font-medium text-primary-500">
        <IdentificationCard className="size-3.5" />
        Aadhaar
      </span>
      {requiresPan && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-caption font-medium text-primary-500">
          <IdentificationCard className="size-3.5" />
          PAN
        </span>
      )}
    </div>
  );

  const startButtonContent = isStartingKyc ? (
    <>
      <SpinnerGap className="mr-2 size-4 animate-spin" />
      Preparing verification...
    </>
  ) : (
    <>
      <ShieldCheck className="mr-2 size-5" />
      Verify with DigiLocker
    </>
  );

  return (
    <ModernCard
      variant="glass"
      padding="lg"
      rounded="lg"
      className="border border-white/40 bg-white/90 shadow-lg backdrop-blur-md"
    >
      {/* Header */}
      <div className="mb-5 flex items-start gap-2 sm:gap-3">
        <div className="flex-shrink-0 rounded-lg bg-primary-50 p-1.5 sm:p-2">
          <ShieldCheck className="size-5 text-primary-500 sm:size-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight text-neutral-700">
            Identity Verification
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Verify the organization admin&apos;s identity securely via
            DigiLocker
          </p>
        </div>
      </div>

      <Separator className="mb-5" />

      {/* Initial status probe */}
      {uiState === "CHECKING" && (
        <div className="flex h-40 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
          <SpinnerGap className="size-6 animate-spin text-neutral-400" />
          <span className="ml-2 text-sm text-neutral-500">
            Checking verification status...
          </span>
        </div>
      )}

      {/* Intro — explain + start */}
      {uiState === "INTRO" && (
        <div className="space-y-5">
          <p className="text-sm text-neutral-600">
            As the organization admin, your identity needs to be verified
            before registration can be completed. You&apos;ll be taken to
            DigiLocker (Government of India) to share the following documents
            securely — no copies are uploaded here.
          </p>

          <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-caption font-semibold uppercase tracking-wide text-neutral-500">
              Required documents
            </p>
            {documentChips}
          </div>

          <div className="flex justify-end">
            <MyButton
              type="button"
              buttonType="primary"
              scale="large"
              layoutVariant="default"
              onClick={() => void handleStartVerification()}
              disable={isStartingKyc}
              className="w-full min-w-32 sm:w-auto"
            >
              {startButtonContent}
            </MyButton>
          </div>
        </div>
      )}

      {/* Waiting — user is completing consent in the DigiLocker tab */}
      {uiState === "WAITING" && (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-8 text-center">
            <SpinnerGap className="size-8 animate-spin text-primary-500" />
            <div>
              <p className="text-sm font-medium text-neutral-700">
                Complete the verification in the DigiLocker tab
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                This page updates automatically once you&apos;re done — keep it
                open.
              </p>
            </div>
          </div>

          {fallbackUrl && (
            <div className="rounded-lg border border-warning-200 bg-warning-50 p-4">
              <div className="flex gap-3">
                <WarningCircle className="mt-0.5 size-5 flex-shrink-0 text-warning-600" />
                <div className="text-sm text-warning-700">
                  <p className="mb-1 font-medium">
                    The DigiLocker tab was blocked by your browser.
                  </p>
                  <a
                    href={fallbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary-500 underline hover:text-primary-400"
                  >
                    Open DigiLocker verification
                    <ArrowSquareOut className="size-4" />
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void handleStartVerification()}
              disabled={isStartingKyc}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-500 hover:text-primary-400 disabled:opacity-50"
            >
              <ArrowClockwise className="size-4" />
              {isStartingKyc
                ? "Preparing a new link..."
                : "Trouble with the tab? Restart verification"}
            </button>
          </div>
        </div>
      )}

      {/* Verified — show extracted details + gated Continue */}
      {uiState === "VERIFIED" && (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-6 text-center">
            <CheckCircle weight="fill" className="size-10 text-success-600" />
            <p className="text-base font-semibold text-neutral-700">
              Identity verified successfully
            </p>
          </div>

          {(summary?.name ||
            summary?.masked_aadhaar ||
            summary?.pan_number) && (
            <dl className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              {summary?.name && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <dt className="text-sm text-neutral-500">Verified name</dt>
                  <dd className="text-sm font-medium text-neutral-700">
                    {summary.name}
                  </dd>
                </div>
              )}
              {summary?.masked_aadhaar && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <dt className="text-sm text-neutral-500">Aadhaar</dt>
                  <dd className="font-mono text-sm font-medium text-neutral-700">
                    {summary.masked_aadhaar}
                  </dd>
                </div>
              )}
              {summary?.pan_number && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <dt className="text-sm text-neutral-500">PAN</dt>
                  <dd className="font-mono text-sm font-medium text-neutral-700">
                    {summary.pan_number}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <div className="flex justify-end">
            <MyButton
              type="button"
              buttonType="primary"
              scale="large"
              layoutVariant="default"
              onClick={() => void onContinue()}
              disable={isSubmitting}
              className="w-full min-w-32 sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <SpinnerGap className="mr-2 size-4 animate-spin" />
                  Submitting...
                </>
              ) : isFinalStep ? (
                "Submit Registration"
              ) : (
                "Continue"
              )}
            </MyButton>
          </div>
        </div>
      )}

      {/* Terminal failure — explain + retry (mints a fresh consent URL) */}
      {uiState === "FAILED" && (
        <div className="space-y-5">
          <div className="rounded-lg border border-warning-200 bg-warning-50 p-4">
            <div className="flex gap-3">
              <WarningCircle className="mt-0.5 size-5 flex-shrink-0 text-warning-600" />
              <div className="text-sm text-warning-700">
                <p className="mb-1 font-medium">Verification not completed</p>
                <p>
                  {FAILURE_MESSAGES[failureStatus ?? "FAILED"] ??
                    FAILURE_MESSAGES.FAILED}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <MyButton
              type="button"
              buttonType="primary"
              scale="large"
              layoutVariant="default"
              onClick={() => void handleStartVerification()}
              disable={isStartingKyc}
              className="w-full min-w-32 sm:w-auto"
            >
              {isStartingKyc ? (
                <>
                  <SpinnerGap className="mr-2 size-4 animate-spin" />
                  Preparing verification...
                </>
              ) : (
                <>
                  <ArrowClockwise className="mr-2 size-5" />
                  Try Again
                </>
              )}
            </MyButton>
          </div>
        </div>
      )}
    </ModernCard>
  );
};

export default KycStep;
