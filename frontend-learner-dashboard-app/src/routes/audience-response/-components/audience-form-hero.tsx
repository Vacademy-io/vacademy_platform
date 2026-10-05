/**
 * The hero half of a public audience response page: cover art, eyebrow,
 * headline, body copy, campaign objective and trust highlights.
 *
 * Every part of it is driven by the campaign's `formAppearance` blob, so an
 * admin can re-shape the top of the page without a release. Each piece is
 * individually optional — a campaign that configured nothing still gets a
 * headline (its own name) and its description, which is what this page showed
 * before the appearance layer existed.
 */
import {
  ChatCircle,
  CheckCircle,
  Clock,
  ShieldCheck,
  Sparkle,
  Target,
  Users,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type {
  AudienceFormAppearance,
  AudienceFormHighlightIcon,
} from "../-utils/form-appearance";
import {
  resolveHeadline,
  resolveHeadlineHtml,
  resolveHeroBodyHtml,
} from "../-utils/form-appearance";
import {
  FORM_ACCENT_SOFT_CLASS,
  FORM_ACCENT_TEXT_CLASS,
  FORM_JUSTIFY_CLASS,
  FORM_RICH_TEXT_CLASS,
  FORM_SELF_ALIGN_CLASS,
  FORM_TEXT_ALIGN_CLASS,
} from "../-utils/form-appearance-styles";

const HIGHLIGHT_ICON_COMPONENTS: Record<AudienceFormHighlightIcon, Icon> = {
  sparkle: Sparkle,
  shield: ShieldCheck,
  clock: Clock,
  check: CheckCircle,
  users: Users,
  chat: ChatCircle,
};

interface AudienceFormHeroProps {
  appearance: AudienceFormAppearance;
  campaignName: string;
  campaignDescription?: string | null;
  campaignObjective?: string | null;
  objectiveLabel: string;
  className?: string;
}

export const AudienceFormHero = ({
  appearance,
  campaignName,
  campaignDescription,
  campaignObjective,
  objectiveLabel,
  className,
}: AudienceFormHeroProps) => {
  // Rich text from the admin's editor wins; otherwise the plain override, else
  // the campaign's own name — which is all this page showed before.
  const headlineHtml = resolveHeadlineHtml(appearance);
  const headline = resolveHeadline(appearance, campaignName);
  const align = appearance.headingAlign;
  const bodyHtml = resolveHeroBodyHtml(appearance, campaignDescription);
  const objective = appearance.showObjective
    ? (campaignObjective ?? "").trim()
    : "";
  // The i18n string is "Objective:" — the colon reads as a typo once the label
  // is set as an uppercase caption above its own value.
  const objectiveHeading = objectiveLabel.replace(/[:：]\s*$/, "");
  const eyebrow = appearance.eyebrow.trim();

  return (
    <header
      className={cn("flex flex-col gap-4", FORM_TEXT_ALIGN_CLASS[align], className)}
    >
      {appearance.coverImageUrl && (
        <img
          src={appearance.coverImageUrl}
          alt=""
          loading="lazy"
          className="max-h-64 w-full rounded-xl object-cover shadow-sm"
          // A dead cover URL should leave no gap, not a torn-page icon.
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}

      {eyebrow && (
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold uppercase tracking-wide-08",
            FORM_SELF_ALIGN_CLASS[align],
            FORM_ACCENT_SOFT_CLASS[appearance.accent]
          )}
        >
          <Sparkle className="size-3.5" weight="fill" aria-hidden="true" />
          {eyebrow}
        </span>
      )}

      {headlineHtml ? (
        // A <div role="heading">, not an <h1>: the editor wraps its text in
        // <p>, and a <p> inside an <h1> is invalid markup the browser
        // re-parents out of the heading.
        <div
          role="heading"
          aria-level={1}
          className={cn(
            "text-h2 font-semibold text-foreground sm:text-h1",
            FORM_RICH_TEXT_CLASS
          )}
          dangerouslySetInnerHTML={{ __html: headlineHtml }}
        />
      ) : (
        headline && (
          <h1 className="text-h2 font-semibold text-foreground sm:text-h1">
            {headline}
          </h1>
        )
      )}

      {bodyHtml && (
        <div
          className={cn(
            "text-body leading-relaxed text-muted-foreground sm:text-subtitle",
            FORM_RICH_TEXT_CLASS
          )}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      )}

      {objective && (
        // text-start: a boxed icon + label row reads wrong centred, whatever
        // alignment the heading above it uses. Logical, not text-left, so an
        // RTL page keeps its natural edge.
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-card text-start">
          {/* Muted, not accent-coloured: the brand colour on this page belongs
              to the submit button. A second coloured element next to it reads
              as a second call to action. */}
          <Target
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            weight="regular"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <p className="text-caption font-semibold uppercase tracking-wide-08 text-muted-foreground">
              {objectiveHeading}
            </p>
            <p className="text-body text-foreground">{objective}</p>
          </div>
        </div>
      )}

      {appearance.highlights.length > 0 && (
        <ul className={cn("flex flex-wrap gap-stack", FORM_JUSTIFY_CLASS[align])}>
          {appearance.highlights.map((highlight) => {
            const HighlightIcon = HIGHLIGHT_ICON_COMPONENTS[highlight.icon];
            return (
              <li
                key={highlight.id}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-caption text-foreground"
              >
                <HighlightIcon
                  className={cn("size-4", FORM_ACCENT_TEXT_CLASS[appearance.accent])}
                  weight="duotone"
                  aria-hidden="true"
                />
                {highlight.text}
              </li>
            );
          })}
        </ul>
      )}
    </header>
  );
};

export default AudienceFormHero;
