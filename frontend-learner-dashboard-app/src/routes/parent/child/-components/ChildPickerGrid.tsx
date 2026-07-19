import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ChildAvatar } from "./ChildAvatar";
import type { ParentChildSummary } from "../-types/parent-child";

interface ChildPickerGridProps {
  children: ParentChildSummary[];
  parentName?: string;
  onSelect: (child: ParentChildSummary) => void;
}

/**
 * Friendly child picker. Design-system clean adaptation of the old
 * ChildSelectionScreen — tokens only, no raw hex, boring-avatars for a warm
 * per-child colour without hardcoding a palette.
 */
export function ChildPickerGrid({ children, parentName, onSelect }: ChildPickerGridProps) {
  const { t } = useTranslation("parent");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4 sm:p-8">
      <div className="text-center">
        <h1 className="text-h1 font-semibold text-foreground">
          {t("picker.hello", { name: parentName || t("picker.parent") })}
        </h1>
        <p className="mt-2 text-body text-muted-foreground">{t("picker.choose")}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6">
        {children.map((child) => (
          <button
            key={child.childUserId}
            id={`child-profile-${child.childUserId}`}
            onClick={() => onSelect(child)}
            className={cn(
              "group flex w-40 flex-col items-center gap-3 rounded-2xl p-4",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
              "transition-transform hover:-translate-y-1",
            )}
          >
            <div className="size-24 overflow-hidden rounded-2xl border border-border shadow-sm transition-shadow group-hover:shadow-md sm:size-28">
              <ChildAvatar
                name={child.fullName || ""}
                fileId={child.profilePicFileId}
                textClassName="text-h1"
              />
            </div>
            <div className="text-center">
              <p className="text-body font-semibold text-foreground group-hover:text-primary-500">
                {child.fullName}
              </p>
              {child.enrollments?.[0]?.batchName ? (
                <p className="mt-0.5 text-caption text-muted-foreground">
                  {child.enrollments[0].batchName}
                </p>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
