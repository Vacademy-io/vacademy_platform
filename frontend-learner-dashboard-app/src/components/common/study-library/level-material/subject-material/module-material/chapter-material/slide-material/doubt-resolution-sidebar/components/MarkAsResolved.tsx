import { Check, ArrowCounterClockwise, CircleNotch } from "@phosphor-icons/react";
import { Doubt as DoubtType } from "../types/get-doubts-type";
import { useAddDoubt } from "../services/AddDoubt";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

/**
 * Resolve / reopen the learner's own doubt. A labelled action (not the old
 * Switch): resolving is a decision the learner takes once, and a toggle read
 * as a setting they had to interpret.
 */
export const MarkAsResolved = ({ doubt, refetch }: { doubt: DoubtType; refetch: () => void }) => {
    const { t } = useTranslation("studyContent");
    const addDoubt = useAddDoubt();
    const isResolved = doubt.status === "RESOLVED";

    const handleToggleResolved = () => {
        if (addDoubt.isPending) return;
        addDoubt.mutate(
            { ...doubt, status: isResolved ? "ACTIVE" : "RESOLVED" },
            {
                onSuccess: () => refetch(),
                onError: () => toast.error(t("doubts.errorResolving")),
            }
        );
    };

    return (
        <button
            type="button"
            onClick={handleToggleResolved}
            disabled={addDoubt.isPending}
            aria-busy={addDoubt.isPending}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
        >
            {addDoubt.isPending ? (
                <CircleNotch size={12} className="animate-spin" />
            ) : isResolved ? (
                <ArrowCounterClockwise size={12} />
            ) : (
                <Check size={12} />
            )}
            {isResolved ? t("doubts.reopen") : t("doubts.markResolvedAction")}
        </button>
    );
};
