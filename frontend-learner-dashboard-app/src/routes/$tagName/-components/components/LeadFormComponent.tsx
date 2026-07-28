import React, { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { CustomFieldRenderer } from "@/components/common/custom-fields/CustomFieldRenderer";
import { getFieldRenderType } from "@/components/common/enroll-by-invite/-utils/custom-field-helpers";
import {
  handleGetAudienceCampaign,
  handleSubmitAudienceLead,
  submitAudienceLead,
} from "@/routes/audience-response/-services/audience-campaign-services";
import { isSpamSubmission } from "../../-utils/website-lead";

/**
 * Lead Form — an Audience campaign's form rendered natively on a catalogue
 * page (inline section or inside the popup modal).
 *
 * The form DEFINITION lives in the CRM: the campaign's AUDIENCE_FORM custom
 * fields (label, type, options, mandatory, order) are fetched from the
 * anonymous `open/v1/audience/campaign/{instituteId}/{audienceId}` endpoint,
 * so the admin edits fields once in Audience Manager and every placement of
 * the form follows. Submissions go through the same `lead/submit` pipeline
 * the standalone /audience-response page uses — dedup, scoring, counsellor
 * assignment and workflows all behave identically.
 *
 * This intentionally does NOT reuse the /audience-response page component:
 * that renders full-page chrome (nav bar, glass cards) for iframe embedding.
 * Here the fields render bare, on catalogue tokens, inside whatever section
 * or dialog hosts them.
 */

interface LeadFormProps {
  /** The Audience campaign whose form to render. Chosen by the admin. */
  audienceId?: string;
  /** Snapshot of the campaign name for the editor UI; display uses live data. */
  audienceName?: string;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  successMessage?: string;
  /** 'card' wraps the fields in an elevated card; 'bare' for modal/column use. */
  layout?: "card" | "bare";
  align?: "center" | "left";
  backgroundColor?: string;
  /** 'section' renders the full catalogue section; 'embedded' just the form. */
  variant?: "section" | "embedded";
  instituteId?: string;
  isPreviewMode?: boolean;
}

interface FormFieldDef {
  id: string;
  key: string;
  name: string;
  type: string;
  config: string;
  mandatory: boolean;
}

export const LeadFormComponent: React.FC<LeadFormProps> = ({
  audienceId,
  title,
  subtitle,
  submitLabel,
  successMessage,
  layout = "card",
  align = "center",
  backgroundColor,
  variant = "section",
  instituteId,
  isPreviewMode = false,
}) => {
  const { data: campaign, isLoading, isError } = useQuery({
    ...handleGetAudienceCampaign({
      instituteId: instituteId || "",
      audienceId: audienceId || "",
    }),
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const mountedAt = useRef(Date.now());

  const fields: FormFieldDef[] = useMemo(() => {
    const raw = campaign?.institute_custom_fields || [];
    return raw
      .filter((f) => f?.custom_field && f.status !== "DELETED")
      .sort((a, b) => (a.individual_order ?? 0) - (b.individual_order ?? 0))
      .map((f) => ({
        id: f.custom_field.id,
        key: f.custom_field.fieldKey,
        name: f.custom_field.fieldName,
        type: f.custom_field.fieldType || "text",
        config: f.custom_field.config || "{}",
        mandatory: !!f.custom_field.isMandatory,
      }));
  }, [campaign]);

  const isLeft = align === "left";

  const section = (children: React.ReactNode) =>
    variant === "embedded" ? (
      <div>{children}</div>
    ) : (
      <section
        className="catalogue-section bg-catalogue-bg"
        style={backgroundColor ? { backgroundColor } : undefined}
      >
        <div className="catalogue-shell-narrow">
          {(title || subtitle) && (
            <div className={`catalogue-section-header ${isLeft ? "text-start" : "text-center"}`}>
              {title && <h2 className="catalogue-h2 text-catalogue-text-primary">{title}</h2>}
              {subtitle && (
                <p className={`catalogue-lead text-catalogue-text-muted ${isLeft ? "catalogue-measure-start" : "catalogue-measure"}`}>
                  {subtitle}
                </p>
              )}
            </div>
          )}
          {children}
        </div>
      </section>
    );

  // ── Unconfigured / broken: guide the admin, stay invisible to visitors ──
  if (!audienceId || !instituteId) {
    if (!isPreviewMode) return null;
    return section(
      <div className="catalogue-card rounded-catalogue-lg border border-dashed border-catalogue-border p-8 text-center text-sm text-catalogue-text-muted">
        Pick an audience campaign in the properties panel — its form fields render here.
      </div>
    );
  }

  if (isLoading) {
    return section(
      <div className="catalogue-card-elevated space-y-4 p-6" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i}>
            <div className="catalogue-skeleton-shimmer mb-2 h-4 w-1/3 rounded" />
            <div className="catalogue-skeleton-shimmer h-10 w-full rounded-catalogue-md" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || fields.length === 0) {
    if (!isPreviewMode) return null;
    return section(
      <div className="catalogue-card rounded-catalogue-lg border border-dashed border-catalogue-border p-8 text-center text-sm text-catalogue-text-muted">
        {isError
          ? "Couldn't load this campaign. Check that it is ACTIVE and belongs to this institute."
          : "This campaign has no form fields yet — add them in Audience Manager."}
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPreviewMode) return;
    setError("");

    const missing = fields.filter((f) => f.mandatory && !(values[f.key] || "").trim());
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map((f) => f.name).join(", ")}`);
      return;
    }

    // Spam verdicts show the normal success state — never tell a bot it lost.
    if (isSpamSubmission(honeypot, mountedAt.current)) {
      setDone(true);
      return;
    }

    setSubmitting(true);
    try {
      const formValues: Record<string, { value: string; id: string }> = {};
      fields.forEach((f) => {
        formValues[f.key] = { value: values[f.key] || "", id: f.id };
      });
      const payload = handleSubmitAudienceLead(
        formValues,
        audienceId,
        audienceId,
        fields.map((f) => ({ id: f.id, field_key: f.key }))
      );
      await submitAudienceLead(payload);
      setDone(true);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return section(
      <div
        className="catalogue-card-elevated flex flex-col items-center gap-3 p-8 text-center"
        role="status"
      >
        <CheckCircle size={40} weight="duotone" className="text-catalogue-brand-ink" aria-hidden="true" />
        <p className="text-base font-semibold text-catalogue-text-primary">
          {successMessage || "Thank you! We've received your details."}
        </p>
      </div>
    );
  }

  const formBody = (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {fields.map((f) => (
        <div key={f.id}>
          <label className="mb-1.5 block text-sm font-medium text-catalogue-text-secondary">
            {f.name}
            {f.mandatory && <span className="ms-1 text-catalogue-brand-ink">*</span>}
          </label>
          <CustomFieldRenderer
            type={getFieldRenderType(f.key, f.type)}
            name={f.key}
            value={values[f.key] || ""}
            onChange={(v: string) => setValues((prev) => ({ ...prev, [f.key]: v }))}
            config={f.config}
            required={f.mandatory}
          />
        </div>
      ))}

      {/* Honeypot — visually hidden from humans, irresistible to bots.
          aria-hidden + tabIndex -1 keep it out of assistive tech and tabbing. */}
      <div className="sr-only" aria-hidden="true">
        <label>
          Company website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      {error && (
        <p className="rounded-catalogue-md bg-warning-50 px-4 py-2.5 text-sm text-catalogue-text-secondary" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="catalogue-btn catalogue-btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending…" : submitLabel || "Submit"}
        {!submitting && <PaperPlaneTilt size={15} weight="bold" aria-hidden="true" />}
      </button>
    </form>
  );

  return section(
    layout === "card" ? (
      <div className="catalogue-card-elevated relative p-6 sm:p-8">{formBody}</div>
    ) : (
      <div className="relative">{formBody}</div>
    )
  );
};

export default LeadFormComponent;
