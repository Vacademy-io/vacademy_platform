import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarCheck } from "@phosphor-icons/react";
import { ModuleScaffold } from "../../-components/ModuleScaffold";
import { ParentStatusChip } from "../../-components/ParentStatusChip";
import { useChildAttendance, useChildOverview } from "../../-hooks/use-parent-child";

export const Route = createFileRoute("/parent/child/$childId/attendance/")({
  component: AttendanceScreen,
});

function AttendanceScreen() {
  const { childId } = useParams({ from: "/parent/child/$childId/attendance/" });
  const { t } = useTranslation("parent");
  const overview = useChildOverview(childId);
  const { data, isLoading, isError, refetch } = useChildAttendance(childId);

  const childName = overview.data?.child?.fullName || t("common.yourChild");
  const percent = typeof data?.attendancePercentage === "number" ? Math.round(data.attendancePercentage) : null;
  const schedules = Array.isArray(data?.schedules) ? (data!.schedules as Record<string, unknown>[]) : [];

  const tone = percent === null ? "neutral" : percent >= 75 ? "good" : percent >= 60 ? "watch" : "action";

  return (
    <ModuleScaffold
      childId={childId}
      title={t("tiles.attendance")}
      icon="attendance"
      summary={
        percent === null
          ? t("attendance.noData", { name: childName })
          : t("attendance.summary", { name: childName, percent })
      }
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
      isEmpty={percent === null && schedules.length === 0}
      emptyIcon={CalendarCheck}
      emptyTitle={t("attendance.emptyTitle")}
      emptyBody={t("attendance.emptyBody")}
    >
      <div className="flex flex-col gap-4">
        {percent !== null ? (
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4">
            <span className="text-h1 font-semibold text-foreground">{percent}%</span>
            <ParentStatusChip tone={tone} label={t(`tone.${tone}`)} />
          </div>
        ) : null}
      </div>
    </ModuleScaffold>
  );
}
