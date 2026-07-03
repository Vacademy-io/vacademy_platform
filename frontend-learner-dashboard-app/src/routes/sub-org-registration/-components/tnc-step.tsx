import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  ArrowSquareOut,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { ModernCard } from "@/components/design-system/modern-card";
import { MyButton } from "@/components/design-system/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";

interface TncStepProps {
  tncFileId: string | null;
  /** Consent statements, each a required checkbox; inline links via [label](url). */
  tncConsentItems?: string[] | null;
  isSubmitting: boolean;
  onContinue: () => void;
  /** Overrides the button label when TNC isn't the final step (e.g. payment follows). */
  continueLabel?: string;
}

const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

/**
 * Renders a consent statement, converting [label](url) segments into anchors.
 * Built as React nodes (never raw HTML) so institute-authored text stays inert;
 * only http(s) URLs become links.
 */
const renderConsentText = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(LINK_PATTERN);
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <a
        key={`${match.index}-${match[2]}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary-500 underline underline-offset-2 hover:text-primary-400"
      >
        {match[1]}
      </a>,
    );
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
};

/** Step 4 — Terms & Conditions review + required acceptance (PDF and/or consent statements). */
const TncStep = ({
  tncFileId,
  tncConsentItems,
  isSubmitting,
  onContinue,
  continueLabel,
}: TncStepProps) => {
  const consentItems = useMemo(
    () => (tncConsentItems ?? []).filter((item) => item.trim().length > 0),
    [tncConsentItems],
  );
  const hasConsentItems = consentItems.length > 0;

  const [pdfAccepted, setPdfAccepted] = useState(false);
  const [itemsAccepted, setItemsAccepted] = useState<boolean[]>(() =>
    consentItems.map(() => false),
  );

  const {
    data: tncUrl,
    isLoading: isTncUrlLoading,
    isError: isTncUrlError,
  } = useQuery({
    queryKey: ["SUB_ORG_REGISTRATION_TNC_URL", tncFileId],
    queryFn: () => getPublicUrlWithoutLogin(tncFileId),
    enabled: !!tncFileId,
    staleTime: 60 * 60 * 1000,
  });

  // PDF (when present) needs its own accept; every consent statement must be checked.
  // When neither is configured (legacy edge) the generic PDF-accept checkbox gates.
  const allAccepted =
    (tncFileId || !hasConsentItems ? pdfAccepted : true) &&
    (!hasConsentItems || itemsAccepted.every(Boolean));

  const toggleItem = (index: number, checked: boolean) => {
    setItemsAccepted((prev) => {
      const next = [...prev];
      next[index] = checked;
      return next;
    });
  };

  return (
    <ModernCard
      variant="glass"
      padding="lg"
      rounded="lg"
      className="border border-white/40 bg-white/90 shadow-lg backdrop-blur-md"
    >
      <div className="mb-5 flex items-start gap-2 sm:gap-3">
        <div className="flex-shrink-0 rounded-lg bg-primary-50 p-1.5 sm:p-2">
          <FileText className="size-5 text-primary-500 sm:size-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight text-neutral-700">
            Terms &amp; Conditions
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Please review and accept the terms to finish registration
          </p>
        </div>
      </div>

      <Separator className="mb-5" />

      {/* Document viewer (optional) */}
      {tncFileId ? (
        isTncUrlLoading ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
            <SpinnerGap className="size-6 animate-spin text-neutral-400" />
            <span className="ml-2 text-sm text-neutral-500">
              Loading document...
            </span>
          </div>
        ) : isTncUrlError || !tncUrl ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-center">
            <WarningCircle className="size-6 text-warning-600" />
            <p className="text-sm text-neutral-500">
              We couldn&apos;t load the Terms &amp; Conditions document. You can
              still accept the terms below to continue.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <iframe
              src={tncUrl}
              title="Terms & Conditions"
              className="h-72 w-full rounded-lg border border-neutral-200 bg-white sm:h-96"
            />
            <a
              href={tncUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 self-end text-sm font-medium text-primary-500 hover:text-primary-400"
            >
              Open in new tab
              <ArrowSquareOut className="size-4" />
            </a>
          </div>
        )
      ) : hasConsentItems ? null : (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
          Please confirm that you accept the institute&apos;s Terms &amp;
          Conditions to finish registration.
        </p>
      )}

      {/* PDF acceptance (only when a document exists, or legacy fallback) */}
      {(tncFileId || !hasConsentItems) && (
        <div className="mt-5 flex items-start gap-3">
          <Checkbox
            id="sub-org-tnc-accept"
            checked={pdfAccepted}
            onCheckedChange={(checked) => setPdfAccepted(checked === true)}
            disabled={isSubmitting}
            className="mt-0.5"
          />
          <label
            htmlFor="sub-org-tnc-accept"
            className="cursor-pointer text-sm text-neutral-600"
          >
            I accept the Terms &amp; Conditions
            <span className="text-danger-600"> *</span>
          </label>
        </div>
      )}

      {/* Consent statements — each its own required checkbox, links open in new tabs */}
      {hasConsentItems && (
        <div className="mt-5 flex flex-col gap-4">
          {consentItems.map((item, index) => (
            <div key={index} className="flex items-start gap-3">
              <Checkbox
                id={`sub-org-tnc-consent-${index}`}
                checked={itemsAccepted[index] ?? false}
                onCheckedChange={(checked) => toggleItem(index, checked === true)}
                disabled={isSubmitting}
                className="mt-0.5"
              />
              <label
                htmlFor={`sub-org-tnc-consent-${index}`}
                className="cursor-pointer text-sm leading-relaxed text-neutral-600"
              >
                {renderConsentText(item)}
                <span className="text-danger-600"> *</span>
              </label>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <MyButton
          type="button"
          buttonType="primary"
          scale="large"
          layoutVariant="default"
          onClick={onContinue}
          disable={!allAccepted || isSubmitting}
          className="w-full min-w-32 sm:w-auto"
        >
          {isSubmitting ? (
            <>
              <SpinnerGap className="mr-2 size-4 animate-spin" />
              Submitting...
            </>
          ) : (
            continueLabel ?? "Submit Registration"
          )}
        </MyButton>
      </div>
    </ModernCard>
  );
};

export default TncStep;
