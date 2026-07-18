import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LoadingState, ErrorState } from "@/components/design-system/states";
import { ParentModuleIcon } from "@/components/parent/ParentModuleIcon";
import { ParentChildShell } from "../-components/ParentChildShell";
import { AttentionCard } from "../-components/AttentionCard";
import { MODULE_TILES } from "../-components/module-tiles";
import { useChildOverview } from "../-hooks/use-parent-child";
import { buildAttentionItems, greeting } from "../-lib/summaries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/parent/child/$childId/")({
  component: ChildHome,
});

function ChildHome() {
  const { childId } = useParams({ from: "/parent/child/$childId/" });
  const { t } = useTranslation("parent");
  const navigate = useNavigate();
  const { data: overview, isLoading, isError, refetch } = useChildOverview(childId);

  if (isLoading) return <LoadingState variant="card" />;
  if (isError || !overview) {
    return (
      <ParentChildShell backTo="picker" title={t("home.title")}>
        <ErrorState
          title={t("common.errorTitle")}
          message={t("common.errorBody")}
          onRetry={() => refetch()}
        />
      </ParentChildShell>
    );
  }

  const childName = overview.child?.fullName || t("common.yourChild");
  const available = new Set(overview.availableModules ?? []);
  const tiles = MODULE_TILES.filter((tile) => available.has(tile.key));
  const attention = buildAttentionItems(overview, t);

  return (
    <ParentChildShell
      child={{ childUserId: childId, fullName: childName }}
      backTo="picker"
    >
      <div className="flex flex-col gap-5">
        {/* Greeting hero */}
        <div className="flex items-center gap-3">
          <div className="size-14 shrink-0">
            <ParentModuleIcon name="progress" />
          </div>
          <div>
            <h1 className="text-h2 font-semibold text-foreground">{greeting(childName, t)}</h1>
          </div>
        </div>

        <AttentionCard childId={childId} items={attention} />

        {/* Module tiles */}
        <div className="grid grid-cols-2 gap-4 md-tablets:grid-cols-3">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              data-tour={tile.tour}
              onClick={() => navigate({ to: `/parent/child/${childId}/${tile.segment}` as never })}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center",
                "min-h-28 transition-transform hover:-translate-y-0.5",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
              )}
            >
              <div className="size-12">
                <ParentModuleIcon name={tile.icon} />
              </div>
              <span className="text-body font-medium text-foreground">{t(tile.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>
    </ParentChildShell>
  );
}
