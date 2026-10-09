import React, { useId } from "react";
import { useTranslation } from "react-i18next";
import { Translate } from "@phosphor-icons/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useSiteT } from "../../-utils/catalogue-locale";
import type { LanguageVersionOption } from "../-utils/course-version-selection";

/**
 * Segmented "Language" control on the course overview cards: one segment per
 * language version of the course (labels and chips from
 * globalSettings.courseLanguages). A version without an invite cannot be
 * enrolled in, so its segment is disabled and says why. Renders nothing for
 * a course with fewer than two languages.
 */
export const CourseLanguagePicker: React.FC<{
  options: LanguageVersionOption[];
  selectedPackageSessionId: string | null;
  onSelect: (packageSessionId: string) => void;
  className?: string;
}> = ({ options, selectedPackageSessionId, onSelect, className }) => {
  const { t } = useTranslation("coursePlayerB");
  const siteT = useSiteT();
  const labelId = useId();
  if (options.length < 2) return null;

  const active = options.find((o) => o.packageSessionId === selectedPackageSessionId)?.code ?? "";
  const unavailable = t("courseDetails.languagePicker.unavailable", "Not open for enrolment yet");

  return (
    <div className={cn("space-y-1.5", className)}>
      <span
        id={labelId}
        className="flex items-center gap-1.5 text-xs font-medium text-catalogue-text-secondary"
      >
        <Translate size={13} className="text-catalogue-text-muted" weight="duotone" aria-hidden="true" />
        {t("courseDetails.languagePicker.label", "Language")}
      </span>
      <ToggleGroup
        type="single"
        value={active}
        onValueChange={(code) => {
          // Radix clears the value when the active segment is pressed again;
          // a version is always selected, so that press is ignored.
          const option = options.find((o) => o.code === code);
          if (!option || option.disabled || option.packageSessionId === selectedPackageSessionId) return;
          onSelect(option.packageSessionId);
        }}
        aria-labelledby={labelId}
        className="flex w-full flex-wrap gap-1 rounded-catalogue-md border border-catalogue-border-subtle bg-catalogue-bg-subtle p-1"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.code}
            value={option.code}
            disabled={option.disabled}
            title={option.disabled ? unavailable : undefined}
            className={cn(
              "h-9 min-w-0 flex-1 gap-1.5 rounded-catalogue-sm px-2 text-xs font-semibold text-catalogue-text-secondary",
              "hover:bg-catalogue-interactive-hover hover:text-catalogue-text-primary",
              "data-[state=on]:bg-catalogue-bg-elevated data-[state=on]:text-catalogue-text-primary data-[state=on]:shadow-sm",
              // Keep the pointer so the title explains WHY it is disabled.
              "disabled:pointer-events-auto disabled:cursor-not-allowed",
            )}
          >
            {option.chip && option.chip !== option.label && (
              <span
                aria-hidden="true"
                className="shrink-0 rounded-catalogue-xs bg-primary-50 px-1 text-3xs font-bold text-catalogue-brand-ink"
              >
                {option.chip}
              </span>
            )}
            <span className="truncate">{siteT(option.label)}</span>
            {option.disabled && <span className="sr-only">, {unavailable}</span>}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
};

export default CourseLanguagePicker;
