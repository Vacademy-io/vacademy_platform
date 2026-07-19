import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Exam, FileText, CaretRight } from "@phosphor-icons/react";
import { ModuleScaffold } from "../../-components/ModuleScaffold";
import {
  useChildAssessments,
  useChildReports,
  useChildOverview,
} from "../../-hooks/use-parent-child";

export const Route = createFileRoute("/parent/child/$childId/assessments/")({
  component: AssessmentsScreen,
});

function AssessmentsScreen() {
  const { childId } = useParams({ from: "/parent/child/$childId/assessments/" });
  const { t } = useTranslation("parent");
  const navigate = useNavigate();
  const overview = useChildOverview(childId);
  const { data: history, isLoading, isError, refetch } = useChildAssessments(childId);
  const { data: reports } = useChildReports(childId);

  const childName = overview.data?.child?.fullName || t("common.yourChild");
  const assessmentsArr = Array.isArray((history as Record<string, unknown> | null)?.assessments)
    ? ((history as Record<string, unknown>).assessments as Record<string, unknown>[])
    : [];
  const count = assessmentsArr.length;

  return (
    <ModuleScaffold
      childId={childId}
      title={t("tiles.assessments")}
      icon="assessments"
      summary={t("assessments.summary", { name: childName, count })}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
      isEmpty={count === 0 && (reports?.length ?? 0) === 0}
      emptyIcon={Exam}
      emptyTitle={t("assessments.emptyTitle")}
      emptyBody={t("assessments.emptyBody")}
    >
      <div className="flex flex-col gap-5">
        {assessmentsArr.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {assessmentsArr.map((a, i) => (
              <li
                key={String(a.assessmentId ?? i)}
                className="flex items-center justify-between rounded-xl bg-card shadow-sm px-4 py-3"
              >
                <span className="text-body font-medium text-foreground">
                  {String(a.assessmentName ?? a.name ?? t("assessments.test"))}
                </span>
                <span className="text-caption font-semibold text-primary-500">
                  {a.percentage != null ? `${Math.round(Number(a.percentage))}%` : "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Staff-generated detailed report cards, if any exist */}
        {(reports?.length ?? 0) > 0 ? (
          <div className="flex flex-col gap-2">
            <h2 className="text-body font-semibold text-foreground">{t("assessments.fullReports")}</h2>
            <ul className="flex flex-col gap-2">
              {reports?.map((r) => (
                <li key={r.processId}>
                  <button
                    onClick={() =>
                      navigate({ to: `/parent/child/${childId}/reports/${r.processId}` as never })
                    }
                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-card shadow-sm px-4 py-3 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <span className="flex items-center gap-2 text-body text-foreground">
                      <FileText weight="duotone" className="size-5 text-primary-400" aria-hidden />
                      {r.name || t("assessments.report")}
                    </span>
                    <CaretRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </ModuleScaffold>
  );
}
