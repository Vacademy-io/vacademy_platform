import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MyButton } from "@/components/design-system/button";
import {
  LIVE_SESSION_REQUEST_OTP,
  LIVE_SESSION_VERIFY_OTP,
  REQUEST_WHATSAPP_OTP,
  VERIFY_WHATSAPP_OTP,
} from "@/constants/urls";

export interface OtpChannel {
  type: "email" | "phone";
  value: string;
}

interface OtpVerificationDialogProps {
  open: boolean;
  channels: OtpChannel[];
  instituteId: string;
  onVerified: () => void;
  onClose: () => void;
}

const phoneDigits = (value: string) => value.replace(/\D/g, "");

/**
 * Sequential OTP verification for public live-class registration. The session
 * config decides which channels must be verified (email OTP by mail, phone OTP
 * over WhatsApp); each channel is sent + confirmed in turn, then the parent's
 * pending registration is released via onVerified.
 */
export default function OtpVerificationDialog({
  open,
  channels,
  instituteId,
  onVerified,
  onClose,
}: OtpVerificationDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Channel we last auto-sent an OTP to, so reopening/re-rendering doesn't spam.
  const sentToRef = useRef<string>("");

  const current = channels[currentIndex];

  const sendOtp = useCallback(
    async (channel: OtpChannel) => {
      setSending(true);
      try {
        if (channel.type === "email") {
          await axios.post(
            LIVE_SESSION_REQUEST_OTP,
            {
              to: channel.value,
              subject: "Email Verification",
              service: "live-session-registration",
              name: "Learner",
            },
            { params: { instituteId } }
          );
          toast.success(`OTP sent to ${channel.value}`);
        } else {
          await axios.post(REQUEST_WHATSAPP_OTP, {
            phone_number: phoneDigits(channel.value),
            institute_id: instituteId,
          });
          toast.success("OTP sent on WhatsApp");
        }
      } catch (error) {
        console.error("Failed to send OTP:", error);
        toast.error(
          channel.type === "email"
            ? "Could not send the email OTP. Please try again."
            : "Could not send the WhatsApp OTP. Please try again."
        );
      } finally {
        setSending(false);
      }
    },
    [instituteId]
  );

  // Reset + auto-send whenever the dialog opens or moves to the next channel.
  useEffect(() => {
    if (!open) {
      setCurrentIndex(0);
      setOtp("");
      sentToRef.current = "";
      return;
    }
    const channel = channels[currentIndex];
    if (!channel) return;
    const key = `${channel.type}:${channel.value}`;
    if (sentToRef.current !== key) {
      sentToRef.current = key;
      setOtp("");
      sendOtp(channel);
    }
  }, [open, channels, currentIndex, sendOtp]);

  const verifyOtp = async () => {
    if (!current || !otp.trim()) {
      toast.error("Please enter the OTP");
      return;
    }
    setVerifying(true);
    try {
      if (current.type === "email") {
        // Public endpoint: 2xx = verified, invalid/expired OTP throws.
        await axios.post(LIVE_SESSION_VERIFY_OTP, {
          to: current.value,
          otp: otp.trim(),
        });
      } else {
        // Returns a boolean body — a 200 "false" is still a failed verify.
        const response = await axios.post(VERIFY_WHATSAPP_OTP, {
          phone_number: phoneDigits(current.value),
          otp: otp.trim(),
          institute_id: instituteId,
        });
        if (response.data !== true) {
          throw new Error("Invalid OTP");
        }
      }
      toast.success(
        current.type === "email" ? "Email verified" : "Mobile number verified"
      );
      if (currentIndex + 1 < channels.length) {
        setCurrentIndex((i) => i + 1);
      } else {
        onVerified();
      }
    } catch (error) {
      console.error("OTP verification failed:", error);
      toast.error("Invalid or expired OTP. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {current.type === "email" ? "Verify your email" : "Verify your mobile number"}
          </DialogTitle>
          <DialogDescription>
            {current.type === "email"
              ? `We've sent a 6-digit code to ${current.value}.`
              : `We've sent a 6-digit code on WhatsApp to ${current.value}.`}
            {channels.length > 1 &&
              ` (Step ${currentIndex + 1} of ${channels.length})`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter 6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !verifying) verifyOtp();
            }}
          />
          <MyButton
            buttonType="primary"
            type="button"
            className="w-full"
            disable={verifying || sending}
            onClick={verifyOtp}
          >
            {verifying ? "Verifying..." : "Verify"}
          </MyButton>
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
            disabled={sending}
            onClick={() => current && sendOtp(current)}
          >
            {sending ? "Sending..." : "Resend code"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
