import React, { useEffect } from "react";
import { X } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { LeadFormComponent } from "./components/LeadFormComponent";

/**
 * Audience Form popup — lets ANY catalogue button open a campaign's form as a
 * modal instead of navigating away ("register for the webinar" without
 * leaving the page).
 *
 * Opened via the `openAudienceForm` window CustomEvent (detail: {audienceId,
 * title}) — the same event mechanism the legacy lead-collection modal uses,
 * so buttons rendered anywhere in the JSON tree can trigger it without prop
 * drilling. The page shell (CourseSubPage / CourseCataloguePage) owns the
 * listener and mounts this once.
 */

export interface AudienceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  audienceId: string;
  title?: string;
  instituteId: string;
}

export const AudienceFormModal: React.FC<AudienceFormModalProps> = ({
  isOpen,
  onClose,
  audienceId,
  title,
  instituteId,
}) => {
  const { t } = useTranslation("coursePlayerA");

  // Esc closes; lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !audienceId) return null;

  return (
    <div
      className="fixed inset-0 z-catalogue-fixed flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title || t("audienceFormModal.registrationForm")}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("audienceFormModal.closeForm")}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Panel — bottom sheet on mobile, centered card on desktop */}
      <div className="relative max-h-screen-90 w-full overflow-y-auto overscroll-contain rounded-t-catalogue-lg bg-catalogue-bg p-5 shadow-2xl sm:max-w-lg sm:rounded-catalogue-lg sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          {title ? (
            <h2 className="catalogue-h3 text-catalogue-text-primary">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="catalogue-btn catalogue-btn-secondary size-9 shrink-0 justify-center rounded-full p-0"
          >
            <X className="size-4" weight="bold" aria-hidden="true" />
          </button>
        </div>

        <LeadFormComponent
          audienceId={audienceId}
          instituteId={instituteId}
          variant="embedded"
          layout="bare"
        />
      </div>
    </div>
  );
};

export default AudienceFormModal;
