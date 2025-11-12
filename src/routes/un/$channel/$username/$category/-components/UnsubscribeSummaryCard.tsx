import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Mail, MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusCard } from "./StatusCard";

interface UnsubscribeSummaryCardProps {
  icon: LucideIcon;
  channelLabel: string;
  supportEmail: string;
  isError: boolean;
  isPending: boolean;
  activeAction: "UNSUBSCRIBE" | "RESUBSCRIBE";
  onRetry: () => void;
  onResubscribe: () => void;
  statusCardProps: React.ComponentProps<typeof StatusCard>;
}

export const UnsubscribeSummaryCard = ({
  icon: Icon,
  channelLabel,
  supportEmail,
  isError,
  isPending,
  activeAction,
  onRetry,
  onResubscribe,
  statusCardProps,
}: UnsubscribeSummaryCardProps) => {
  const isResubscribePending = isPending && activeAction === "RESUBSCRIBE";
  const isUnsubscribePending = isPending && activeAction === "UNSUBSCRIBE";
  const hasSuccessfulUnsubscribe =
    !isError && statusCardProps.state === "success" && activeAction === "UNSUBSCRIBE";

  const showResubscribe = hasSuccessfulUnsubscribe;

  return (
    <Card className="w-full border border-slate-200/70 bg-white/90 shadow-lg ring-1 ring-white/40 backdrop-blur">
      <CardContent className="space-y-6 p-6 sm:p-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-semibold uppercase tracking-wide text-slate-900">
              {channelLabel}
            </h2>
          </div>
          <SummaryIllustration
            state={statusCardProps.state}
            icon={Icon}
            channelLabel={channelLabel}
          />
        </header>

        <StatusCard {...statusCardProps} />

        <div className="flex flex-wrap items-center gap-2">
          {isError ? (
            <>
              <Button onClick={onRetry} disabled={isPending}>
                {isPending ? "Retrying…" : "Try again"}
              </Button>
              {showResubscribe && (
                <Button
                  variant="outline"
                  onClick={onResubscribe}
                  disabled={isResubscribePending}
                >
                  {isResubscribePending ? "Please wait…" : "Resubscribe"}
                </Button>
              )}
            </>
          ) : showResubscribe ? (
            <Button onClick={onResubscribe} disabled={isResubscribePending}>
              {isResubscribePending ? "Please wait…" : "Resubscribe"}
            </Button>
          ) : (
            <Button onClick={onRetry} disabled={isUnsubscribePending}>
              {isUnsubscribePending ? "Please wait…" : "Unsubscribe"}
            </Button>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Need help?{" "}
          <a
            className="font-medium text-primary underline-offset-4 hover:underline"
            href={`mailto:${supportEmail}`}
          >
            {supportEmail}
          </a>
        </p>
      </CardContent>
    </Card>
  );
};

const SummaryIllustration = ({
  state,
  icon: Icon,
  channelLabel,
}: {
  state: "idle" | "pending" | "success" | "error";
  icon: LucideIcon;
  channelLabel: string;
}) => {
  const getBaseIcon = () => {
    if (channelLabel.toLowerCase().includes("whatsapp")) {
      return MessageCircle;
    }
    if (channelLabel.toLowerCase().includes("email")) {
      return Mail;
    }
    return Icon;
  };

  if (state === "success") {
    return (
      <motion.div
        key="success-illustration"
        initial={{ scale: 0.75, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-100 via-emerald-200 to-emerald-100 shadow-inner"
      >
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.24, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </motion.span>
      </motion.div>
    );
  }

  if (state === "pending") {
    return (
      <motion.div
        key="pending-illustration"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 shadow-inner"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </motion.div>
    );
  }

  const BaseIcon = getBaseIcon();
  return (
    <motion.div
      key="idle-illustration"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 shadow-inner"
    >
      <BaseIcon className="h-6 w-6 text-primary" />
    </motion.div>
  );
};

export default SummaryIllustration;

