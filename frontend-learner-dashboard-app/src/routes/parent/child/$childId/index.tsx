import { useEffect } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LoadingState, ErrorState } from "@/components/design-system/states";
import { ParentModuleIcon } from "@/components/parent/ParentModuleIcon";
import { ParentChildShell } from "../-components/ParentChildShell";
import { ParentQuickSearch } from "../-components/ParentQuickSearch";
import { AttentionCard } from "../-components/AttentionCard";
import { buildParentTourSteps } from "../-components/ParentHelpButton";
import { runParentTour } from "../-lib/parent-tour";
import { MODULE_TILES } from "../-components/module-tiles";
import { useChildOverview } from "../-hooks/use-parent-child";
import { buildAttentionItems } from "../-lib/summaries";
import type { ChildOverview } from "../-types/parent-child";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/parent/child/$childId/")({
  component: ChildHome,
});

// Soft per-tile tints (design tokens only) for a warm, friendly grid.
const TILE_TINT: Record<string, string> = {
  progress: "bg-primary-50",
  attendance: "bg-secondary-50",
  assessments: "bg-info-50",
  liveSessions: "bg-tertiary-50",
  payments: "bg-warning-50",
  badges: "bg-success-50",
};

function tileSubtitle(key: string, o: ChildOverview, t: (k: string, opts?: Record<string, unknown>) => string): string {
  switch (key) {
    case "badges":
      return t("tiles.sub.badges", { count: o.badgeCount ?? 0 });
    case "payments":
      return (o.pendingInvoiceCount ?? 0) > 0
        ? t("tiles.sub.feesDue", { count: o.pendingInvoiceCount })
        : t("tiles.sub.feesPaid");
    case "assessments":
      return o.assessmentCount != null
        ? t("tiles.sub.tests", { count: o.assessmentCount })
        : t("tiles.sub.seeTests");
    case "attendance":
      return o.attendancePercent != null
        ? t("tiles.sub.attendance", { percent: Math.round(o.attendancePercent) })
        : t("tiles.sub.seeAttendance");
    case "progress":
      return o.courseCompletionPercent != null
        ? t("tiles.sub.progress", { percent: Math.round(o.courseCompletionPercent) })
        : t("tiles.sub.seeProgress");
    case "liveSessions":
      return o.upcomingSessionCount != null
        ? t("tiles.sub.upcoming", { count: o.upcomingSessionCount })
        : t("tiles.sub.seeClasses");
    default:
      return "";
  }
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-card px-2 py-3 text-center shadow-xs">
      <span className="text-h2 font-semibold text-foreground">{value}</span>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}

function ChildHome() {
  const { childId } = useParams({ from: "/parent/child/$childId/" });
  const { t } = useTranslation("parent");
  const navigate = useNavigate();
  const { data: overview, isLoading, isError, refetch } = useChildOverview(childId);

  // First-visit guided tour (once). Small settle delay so anchors are painted.
  useEffect(() => {
    if (isLoading || isError || !overview) return;
    const KEY = "parent-tour-seen";
    if (localStorage.getItem(KEY)) return;
    const timer = setTimeout(() => {
      localStorage.setItem(KEY, "1");
      runParentTour(buildParentTourSteps(t));
    }, 700);
    return () => clearTimeout(timer);
  }, [isLoading, isError, overview, t]);

  if (isLoading) return <LoadingState variant="card" />;
  if (isError || !overview) {
    return (
      <ParentChildShell childId={childId} backTo="picker">
        <ErrorState
          title={t("common.errorTitle")}
          message={t("common.errorBody")}
          onRetry={() => refetch()}
        />
      </ParentChildShell>
    );
  }

  const childName = overview.child?.fullName || t("common.yourChild");
  const batchName = overview.child?.enrollments?.[0]?.batchName;
  const available = new Set(overview.availableModules ?? []);
  const tiles = MODULE_TILES.filter((tile) => available.has(tile.key));
  const attention = buildAttentionItems(overview, t);

  return (
    <ParentChildShell childId={childId} backTo="picker">
      <div className="flex flex-col gap-6">
        {/* ── Compact greeting ── */}
        <div>
          <h1 className="text-h1 font-semibold text-foreground">
            {t("home.greeting", { name: childName })}
          </h1>
          {batchName ? (
            <p className="mt-0.5 text-caption text-muted-foreground">{batchName}</p>
          ) : null}
        </div>

        <ParentQuickSearch childId={childId} availableKeys={available} />

        {/* ── Module cards FIRST (the main event, CuePilot-style) ── */}
        <div data-tour="parent-tiles" className="grid grid-cols-2 gap-4 md-tablets:grid-cols-3">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              data-tour={tile.tour}
              onClick={() => navigate({ to: `/parent/child/${childId}/${tile.segment}` as never })}
              className={cn(
                "group flex flex-col items-start gap-3 rounded-3xl bg-card p-5 text-start shadow-sm",
                "transition-all hover:-translate-y-1 hover:shadow-md",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
              )}
            >
              <div
                className={cn(
                  "flex size-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-105",
                  TILE_TINT[tile.key] ?? "bg-primary-50",
                )}
              >
                <div className="size-9">
                  <ParentModuleIcon name={tile.icon} />
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-body font-semibold text-foreground">{t(tile.labelKey)}</span>
                <span className="text-caption text-muted-foreground">
                  {tileSubtitle(tile.key, overview, t)}
                </span>
              </div>
            </button>
          ))}
        </div>

        <AttentionCard childId={childId} items={attention} />

        {/* ── At-a-glance stats (secondary, at the bottom) ── */}
        <div className="grid grid-cols-3 gap-3">
          <StatPill label={t("stats.badges")} value={String(overview.badgeCount ?? 0)} />
          <StatPill label={t("stats.certificates")} value={String(overview.certificateCount ?? 0)} />
          <StatPill label={t("stats.feesDue")} value={String(overview.pendingInvoiceCount ?? 0)} />
        </div>
      </div>
    </ParentChildShell>
  );
}
