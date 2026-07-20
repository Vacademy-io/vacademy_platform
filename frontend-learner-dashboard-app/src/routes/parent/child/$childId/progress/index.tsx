import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChartLineUp } from "@phosphor-icons/react";
import { Progress } from "@/components/ui/progress";
import { ModuleScaffold } from "../../-components/ModuleScaffold";
import { useChildSubjectProgress, useChildOverview } from "../../-hooks/use-parent-child";

export const Route = createFileRoute("/parent/child/$childId/progress/")({
  component: ProgressScreen,
});

// The backend serializes this report in snake_case (@JsonProperty) — the same
// shape the learner dashboard reads: subject_name + module_completion_percentage.
function avgCompletion(subject: Record<string, unknown>): number {
  const modules = Array.isArray(subject.modules) ? (subject.modules as Record<string, unknown>[]) : [];
  const vals = modules
    .map((m) => (typeof m.module_completion_percentage === "number" ? m.module_completion_percentage : null))
    .filter((v): v is number => v !== null);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function subjectsOf(course: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(course.subjects) ? (course.subjects as Record<string, unknown>[]) : [];
}

function ProgressScreen() {
  const { childId } = useParams({ from: "/parent/child/$childId/progress/" });
  const { t } = useTranslation("parent");
  const overview = useChildOverview(childId);
  const { data, isLoading, isError, refetch } = useChildSubjectProgress(childId);

  const childName = overview.data?.child?.fullName || t("common.yourChild");
  // The BFF now returns one entry per enrolled course: { packageSessionId, courseName, subjects[] }.
  const courses = (data ?? []) as Record<string, unknown>[];
  const allSubjects = courses.flatMap(subjectsOf);
  const overall =
    allSubjects.length > 0
      ? Math.round(allSubjects.reduce((a, s) => a + avgCompletion(s), 0) / allSubjects.length)
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
      isEmpty={allSubjects.length === 0}
      emptyIcon={ChartLineUp}
      emptyTitle={t("progress.emptyTitle")}
      emptyBody={t("progress.emptyBody")}
    >
      <div className="flex flex-col gap-5">
        {courses.map((course, ci) => {
          const subjects = subjectsOf(course);
          if (subjects.length === 0) return null;
          const courseName = String(course.courseName ?? "");
          return (
            <div key={String(course.packageSessionId ?? ci)} className="flex flex-col gap-3">
              {courseName ? (
                <h2 className="text-body font-semibold text-foreground">{courseName}</h2>
              ) : null}
              <ul className="flex flex-col gap-3">
                {subjects.map((s, i) => {
                  const pct = avgCompletion(s);
                  return (
                    <li key={String(s.subject_id ?? i)} className="rounded-xl bg-card shadow-sm px-4 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-body font-medium text-foreground">
                          {String(s.subject_name ?? t("progress.subject"))}
                        </span>
                        <span className="text-caption font-semibold text-primary-500">{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </ModuleScaffold>
  );
}
