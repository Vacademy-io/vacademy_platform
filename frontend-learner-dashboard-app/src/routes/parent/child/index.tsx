import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Users } from "@phosphor-icons/react";
import { LoadingState, ErrorState, EmptyState } from "@/components/design-system/states";
import { ChildPickerGrid } from "./-components/ChildPickerGrid";
import { useChildren, useParentSettings } from "./-hooks/use-parent-child";

export const Route = createFileRoute("/parent/child/")({
  component: ParentChildPicker,
});

function ParentChildPicker() {
  const { t } = useTranslation("parent");
  const navigate = useNavigate();
  const settings = useParentSettings();
  const { data: children, isLoading, isError, refetch } = useChildren();

  // Auto-select when there's exactly one child — a parent with one child
  // shouldn't have to tap a picker every visit.
  useEffect(() => {
    if (children && children.length === 1) {
      navigate({
        to: "/parent/child/$childId",
        params: { childId: children[0].childUserId },
        replace: true,
      });
    }
  }, [children, navigate]);

  if (isLoading || settings.isLoading) return <LoadingState variant="list" />;

  if (settings.data && !settings.data.enabled) {
    return (
      <EmptyState
        icon={Users}
        title={t("picker.disabledTitle")}
        description={t("picker.disabledBody")}
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={t("common.errorTitle")}
        message={t("common.errorBody")}
        onRetry={() => refetch()}
      />
    );
  }

  if (!children || children.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t("picker.emptyTitle")}
        description={t("picker.emptyBody")}
      />
    );
  }

  if (children.length === 1) return <LoadingState variant="list" />; // navigating

  return (
    <ChildPickerGrid
      children={children}
      onSelect={(child) =>
        navigate({ to: "/parent/child/$childId", params: { childId: child.childUserId } })
      }
    />
  );
}
