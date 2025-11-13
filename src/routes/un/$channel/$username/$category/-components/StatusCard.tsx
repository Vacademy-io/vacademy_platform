import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface StatusCardProps {
  state: "idle" | "pending" | "success" | "error";
  recipient: string;
  successMessage: string;
  errorMessage: string;
  supportEmail: string;
}

export const StatusCard = ({
  state,
  recipient,
  successMessage,
  errorMessage,
  supportEmail,
}: StatusCardProps) => {
  if (state === "idle") {
    return null;
  }

  if (state === "pending") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium text-slate-800">
              Updating your preference
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Hang tight while we update notifications for {recipient}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 shadow-sm">
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-start gap-2.5"
        >
          <motion.span
            key="success-icon"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </motion.span>
          <div>
            <p className="text-sm font-medium text-emerald-700">Preference updated</p>
            <motion.p
              key="success-text"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.08 }}
              className="mt-1 text-xs text-emerald-700"
            >
              {successMessage}
            </motion.p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 shadow-sm">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="h-5 w-5 text-rose-600" />
        <div>
          <p className="text-sm font-medium text-rose-700">
            We couldn&apos;t update this
          </p>
          <p className="mt-1 text-xs text-rose-700">{errorMessage}</p>
          <p className="mt-2 text-[11px] uppercase text-rose-600/70">
            Need support?{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="font-semibold underline-offset-4 hover:underline"
            >
              {supportEmail}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

