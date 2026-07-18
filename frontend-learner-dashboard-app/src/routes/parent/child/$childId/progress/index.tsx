import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChartLineUp } from "@phosphor-icons/react";
import { Progress } from "@/components/ui/progress";
import { ModuleScaffold } from "../../-components/ModuleScaffold";
import { useChildSubjectProgress, useChildOverview } from "../../-hooks/use-parent-child";

export const Route = createFileRoute("/parent/child/$childId/progress/")({
  component: ProgressScreen,
});

function avgCompletion(subject: Record<string, unknown>): number {
  const modules = Array.isArray(subject.modules) ? (subject.modules as Record<string, unknown>[]) : [];
  const vals = modules
    .map((m) => (typeof m.completionPercentage === "number" ? m.completionPercentage : null))
    .filter((v): v is number => v !== null);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function ProgressScreen() {
  const { childId } = useParams({ from: "/parent/child/$childId/progress/" });
  const { t } = useTranslation("parent");
  const overview = useChildOverview(childId);
  const { data, isLoading, isError, refetch } = useChildSubjectProgress(childId);

  const childName = overview.data?.child?.fullName || t("common.yourChild");
  const subjects = (data ?? []) as Record<string, unknown>[];
  const overall =
    subjects.length > 0
      ? Math.round(subjects.reduce((a, s) => a + avgCompletion(s), 0) / subjects.length)
      : 0;

  return (
    <ModuleScaffold
      childId={childId}
      title={t("tiles.progress")}
      icon="progress"
      summary={t("progress.summary", { name: childName, percent: overall })}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
      isEmpty={subjects.length === 0}
      emptyIcon={ChartLineUp}
      emptyTitle={t("progress.emptyTitle")}
      emptyBody={t("progress.emptyBody")}
    >
      <ul className="flex flex-col gap-3">
        {subjects.map((s, i) => {
          const pct = avgCompletion(s);
          return (
            <li key={String(s.subjectId ?? i)} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-body font-medium text-foreground">
                  {String(s.subjectName ?? t("progress.subject"))}
                </span>
                <span className="text-caption font-semibold text-primary-500">{pct}%</span>
              </div>
              <Progress value={pct} className="h-2" />
            </li>
          );
        })}
      </ul>
    </ModuleScaffold>
  );
}
