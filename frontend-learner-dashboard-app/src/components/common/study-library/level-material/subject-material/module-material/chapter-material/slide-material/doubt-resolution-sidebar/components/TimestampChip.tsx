import { Clock, FilePdf, PencilSimple } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

interface TimestampChipProps {
    /** Pre-formatted position label, e.g. "1:02" or "Page 3". */
    label: string;
    isDocument: boolean;
    onEdit: () => void;
}

/**
 * The moment/page a new doubt is anchored to. Pre-filled from the learner's
 * current position and editable in place — no blocking dialog before typing.
 */
export const TimestampChip = ({ label, isDocument, onEdit }: TimestampChipProps) => {
    const { t } = useTranslation("studyContent");

    return (
        <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary-50 px-2 py-1 text-2xs font-semibold text-neutral-800 transition-colors hover:bg-primary-100"
        >
            <span className="flex items-center text-primary-500">
                {isDocument ? <FilePdf size={12} /> : <Clock size={12} />}
            </span>
            <span>{label}</span>
            <span className="flex items-center gap-0.5 text-neutral-500">
                <PencilSimple size={11} />
                {t("doubts.editPosition")}
            </span>
        </button>
    );
};
