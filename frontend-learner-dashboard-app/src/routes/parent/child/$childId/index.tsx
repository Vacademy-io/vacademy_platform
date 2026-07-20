import { useEffect } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { LoadingState, ErrorState } from "@/components/design-system/states";
import { ParentModuleIcon } from "@/components/parent/ParentModuleIcon";
import { ChildAvatar } from "../-components/ChildAvatar";
import { ParentChildShell } from "../-components/ParentChildShell";
import { ParentQuickSearch } from "../-components/ParentQuickSearch";
import { AttentionCard } from "../-components/AttentionCard";
import { getParentFirstName } from "../-lib/parent-identity";
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
  const parentFirstName = getParentFirstName();
  const available = new Set(overview.availableModules ?? []);
  const tiles = MODULE_TILES.filter((tile) => available.has(tile.key));
  const attention = buildAttentionItems(overview, t);

  return (
    <ParentChildShell childId={childId} backTo="picker">
      <div className="flex flex-col gap-6">
        {/* ── Warm gradient hero: parent greeting + child avatar + stats ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="rounded-3xl bg-gradient-to-br from-primary-100 via-secondary-100 to-primary-50 p-6 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
              whileHover={{ scale: 1.06, rotate: -3 }}
              className="size-20 shrink-0 overflow-hidden rounded-3xl shadow-md ring-4 ring-background/60"
            >
              <ChildAvatar
                name={childName}
                fileId={overview.child?.profilePicFileId}
                size={80}
              />
            </motion.div>
            <div className="min-w-0">
              {parentFirstName ? (
                <p className="text-caption font-medium text-primary-500">
                  {t("home.hiParent", { name: parentFirstName })}
                </p>
              ) : null}
              <h1 className="truncate text-h1 font-semibold text-foreground">
                {t("home.greeting", { name: childName })}
              </h1>
              {batchName ? (
                <p className="mt-0.5 truncate text-caption text-muted-foreground">{batchName}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <StatPill label={t("stats.badges")} value={String(overview.badgeCount ?? 0)} />
            <StatPill label={t("stats.certificates")} value={String(overview.certificateCount ?? 0)} />
            <StatPill label={t("stats.feesDue")} value={String(overview.pendingInvoiceCount ?? 0)} />
          </div>
        </motion.div>

        <ParentQuickSearch childId={childId} availableKeys={available} />

        {/* ── Module cards FIRST (the main event, CuePilot-style) ── */}
        <div data-tour="parent-tiles" className="grid grid-cols-2 gap-4 md-tablets:grid-cols-3">
          {tiles.map((tile, idx) => (
            <motion.button
              key={tile.key}
              data-tour={tile.tour}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.3, ease: "easeOut" }}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate({ to: `/parent/child/${childId}/${tile.segment}` as never })}
              className={cn(
                "group flex flex-col items-start gap-3 rounded-3xl bg-card p-5 text-start shadow-sm",
                "transition-shadow hover:shadow-md",
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
            </motion.button>
          ))}
        </div>

        <AttentionCard childId={childId} items={attention} />
      </div>
    </ParentChildShell>
  );
}
