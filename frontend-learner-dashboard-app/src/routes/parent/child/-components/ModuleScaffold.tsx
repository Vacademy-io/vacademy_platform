import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LoadingState, ErrorState, EmptyState } from "@/components/design-system/states";
import type { Icon } from "@phosphor-icons/react";
import { ParentChildShell } from "./ParentChildShell";
import type { ParentIconKey } from "@/components/parent/ParentModuleIcon";
import { ParentModuleIcon } from "@/components/parent/ParentModuleIcon";

interface ModuleScaffoldProps {
  childId: string;
  title: string;
  icon: ParentIconKey;
  /** the plain-language sentence this screen leads with */
  summary?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isEmpty?: boolean;
  emptyIcon?: Icon;
  emptyTitle?: string;
  emptyBody?: string;
  children?: ReactNode;
}

/**
 * Shared per-module wrapper: header (icon + title), the plain-language summary
 * FIRST, then loading/error/empty/content. Enforces the "sentence before chart"
 * rule structurally — every screen renders the summary at the top.
 */
export function ModuleScaffold({
  childId,
  title,
  icon,
  summary,
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyBody,
  children,
}: ModuleScaffoldProps) {
  const { t } = useTranslation("parent");

  return (
    <ParentChildShell child={{ childUserId: childId, fullName: title }} title={title}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="size-12 shrink-0">
            <ParentModuleIcon name={icon} />
          </div>
          {summary ? (
            <p className="text-body text-foreground">{summary}</p>
          ) : null}
        </div>

        {isLoading ? (
          <LoadingState variant="list" />
        ) : isError ? (
          <ErrorState
            title={t("common.errorTitle")}
            message={t("common.errorBody")}
            onRetry={onRetry}
          />
        ) : isEmpty ? (
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle || t("common.emptyTitle")}
            description={emptyBody}
          />
        ) : (
          children
        )}
      </div>
    </ParentChildShell>
  );
}
