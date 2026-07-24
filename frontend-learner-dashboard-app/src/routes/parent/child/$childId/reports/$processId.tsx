import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { StudentReportCard } from "@/components/common/my-reports/StudentReportCard";
import { LoadingState, ErrorState, EmptyState } from "@/components/design-system/states";
import { FileText } from "@phosphor-icons/react";
import { ParentChildShell } from "../../-components/ParentChildShell";
import {
  fetchChildReportDetail,
  type ChildReportDetail,
} from "../../-services/parent-portal-api";
import type { V2ReportData } from "@/services/student-reports-api";
import { getCachedInstituteBranding } from "@/services/domain-routing";

export const Route = createFileRoute("/parent/child/$childId/reports/$processId")({
  component: ParentReportDetail,
});

function ParentReportDetail() {
  const { childId, processId } = useParams({
    from: "/parent/child/$childId/reports/$processId",
  });
  const { t } = useTranslation("parent");

  const [detail, setDetail] = useState<ChildReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchChildReportDetail(processId)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [processId]);

  if (loading) {
    return (
      <ParentChildShell childId={childId}>
        <LoadingState variant="card" />
      </ParentChildShell>
    );
  }

  if (error || !detail) {
    return (
      <ParentChildShell childId={childId}>
        <ErrorState title={t("common.errorTitle")} message={t("common.errorBody")} />
      </ParentChildShell>
    );
  }

  if (detail.status !== "COMPLETED" || !detail.comprehensive_report) {
    return (
      <ParentChildShell childId={childId}>
        <EmptyState
          icon={FileText}
          title={t("assessments.reportPendingTitle")}
          description={t("assessments.reportPendingBody")}
        />
      </ParentChildShell>
    );
  }

  return (
    <ParentChildShell childId={childId}>
      <StudentReportCard
        data={detail.comprehensive_report as V2ReportData}
        fallbackLogoUrl={getCachedInstituteBranding()?.instituteLogoUrl ?? undefined}
      />
    </ParentChildShell>
  );
}
