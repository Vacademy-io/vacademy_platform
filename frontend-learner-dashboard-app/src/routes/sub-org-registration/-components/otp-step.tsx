import { useState } from "react";
import {
  EnvelopeSimple,
  Info,
  SpinnerGap,
  CheckCircle,
  CaretLeft,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { ModernCard } from "@/components/design-system/modern-card";
import { MyButton } from "@/components/design-system/button";
import { cn } from "@/lib/utils";

interface OtpStepProps {
  /** Email the code was sent to (admin email from the details step) */
  email: string;
  /** Verifies through OUR /verify-otp endpoint (registration-scoped). Should throw on failure. */
  onVerify: (otp: string) => Promise<void>;
  onResend: () => Promise<void>;
  onEditDetails: () => void;
  isVerifying: boolean;
  isResending: boolean;
}

/**
 * Step 2 — email OTP verification. Lifted copy of the OTP sub-step from
 * enroll-by-invite/registration-step.tsx, rewired to the sub-org registration
 * /verify-otp + /resend-otp endpoints via the callbacks (NOT the
 * notification-service live-session endpoints).
 */
const OtpStep = ({
  email,
  onVerify,
  onResend,
  onEditDetails,
  isVerifying,
  isResending,
}: OtpStepProps) => {
  const [otp, setOtp] = useState("");

  const handleVerifyClick = async () => {
    if (!otp.trim() || otp.length < 4) {
      toast.error("Please enter a valid verification code");
      return;
    }
    await onVerify(otp);
  };

  return (
    <ModernCard
      variant="glass"
      padding="lg"
      rounded="lg"
      className="border border-white/40 bg-white/90 shadow-lg backdrop-blur-md"
    >
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary-50">
          <EnvelopeSimple className="size-8 text-primary-500" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-neutral-700">
          Verify Your Email
        </h2>
        <p className="text-sm text-neutral-500">
          We&apos;ve sent a verification code to
        </p>
        <p className="mt-1 text-sm font-medium text-neutral-700">{email}</p>
      </div>

      {/* Instructions */}
      <div className="mb-6 rounded-lg border border-warning-200 bg-warning-50 p-4">
        <div className="flex gap-3">
          <Info className="mt-0.5 size-5 flex-shrink-0 text-warning-600" />
          <div className="text-sm text-warning-700">
            <p className="mb-1 font-medium">Can&apos;t find the email?</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                Check your <strong>Spam</strong> or <strong>Junk</strong> folder
              </li>
              <li>Make sure the email address is correct</li>
              <li>Wait a few seconds and refresh your inbox</li>
            </ul>
          </div>
        </div>
      </div>

      {/* OTP Input */}
      <div className="space-y-4">
        <div>
          <label
            htmlFor="sub-org-otp-input"
            className="mb-2 block text-sm font-medium text-neutral-600"
          >
            Enter Verification Code
          </label>
          <input
            id="sub-org-otp-input"
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            className={cn(
              "w-full rounded-lg border border-neutral-300 px-4 py-3 text-center font-mono text-lg tracking-widest",
              "outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            )}
            maxLength={6}
            autoFocus
            disabled={isVerifying}
          />
        </div>

        {/* Verify Button */}
        <MyButton
          type="button"
          buttonType="primary"
          scale="large"
          layoutVariant="default"
          onClick={handleVerifyClick}
          disable={isVerifying || otp.length < 4}
          className="w-full"
        >
          {isVerifying ? (
            <>
              <SpinnerGap className="mr-2 size-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 size-5" />
              Verify & Continue
            </>
          )}
        </MyButton>

        {/* Resend & Back Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onEditDetails}
            className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-600"
            disabled={isVerifying}
          >
            <CaretLeft className="size-4" />
            Edit Details
          </button>

          <button
            type="button"
            onClick={() => void onResend()}
            disabled={isResending || isVerifying}
            className="text-sm font-medium text-primary-500 hover:text-primary-400 disabled:opacity-50"
          >
            {isResending ? "Sending..." : "Resend Code"}
          </button>
        </div>
      </div>
    </ModernCard>
  );
};

export default OtpStep;
