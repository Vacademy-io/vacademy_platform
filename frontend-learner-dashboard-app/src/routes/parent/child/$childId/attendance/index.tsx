import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { CalendarCheck } from "@phosphor-icons/react";
import { ModuleScaffold } from "../../-components/ModuleScaffold";
import { ParentStatusChip } from "../../-components/ParentStatusChip";
import type { ParentStatusTone } from "../../-components/ParentStatusChip";
import { useChildAttendance, useChildOverview } from "../../-hooks/use-parent-child";

export const Route = createFileRoute("/parent/child/$childId/attendance/")({
  component: AttendanceScreen,
});

// present → green tick, absent → red cross, late → amber, anything else → neutral.
// Always colour + icon + word (ParentStatusChip), never colour alone.
function statusToneLabel(status: unknown, t: TFunction): { tone: ParentStatusTone; label: string } {
  const s = String(status ?? "").toUpperCase();
  if (s === "PRESENT") return { tone: "good", label: t("attendance.present") };
  if (s === "ABSENT") return { tone: "action", label: t("attendance.absent") };
  if (s === "LATE") return { tone: "watch", label: t("attendance.late") };
  return { tone: "neutral", label: t("attendance.notMarked") };
}

function formatDate(meetingDate: unknown): string {
  const raw = typeof meetingDate === "string" ? meetingDate : "";
  if (!raw) return "";
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function AttendanceScreen() {
  const { childId } = useParams({ from: "/parent/child/$childId/attendance/" });
  const { t } = useTranslation("parent");
  const overview = useChildOverview(childId);
  const { data, isLoading, isError, refetch } = useChildAttendance(childId);

  const childName = overview.data?.child?.fullName || t("common.yourChild");
  const percent = typeof data?.attendancePercentage === "number" ? Math.round(data.attendancePercentage) : null;
  const schedules = Array.isArray(data?.schedules) ? (data!.schedules as Record<string, unknown>[]) : [];

  // Most recent classes first.
  const recent = [...schedules].sort((a, b) =>
    String(b.meetingDate ?? "").localeCompare(String(a.meetingDate ?? "")),
  );
  const presentCount = schedules.filter(
    (s) => String(s.attendanceStatus ?? "").toUpperCase() === "PRESENT",
  ).length;

  const summaryTone: ParentStatusTone =
    percent === null ? "neutral" : percent >= 75 ? "good" : percent >= 60 ? "watch" : "action";

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
      <div className="flex flex-col gap-5">
        {/* Headline: big % + how many classes attended */}
        {percent !== null ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-card px-5 py-4 shadow-sm">
            <div className="flex flex-col">
              <span className="text-h1 font-semibold text-foreground">{percent}%</span>
              {schedules.length > 0 ? (
                <span className="text-caption text-muted-foreground">
                  {t("attendance.attended", { present: presentCount, total: schedules.length })}
                </span>
              ) : null}
            </div>
            <ParentStatusChip tone={summaryTone} label={t(`tone.${summaryTone}`)} />
          </div>
        ) : null}

        {/* Recent classes — each with a present / absent chip */}
        {recent.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-body font-semibold text-foreground">{t("attendance.recentTitle")}</h2>
            <ul className="flex flex-col gap-2">
              {recent.map((s, i) => {
                const info = statusToneLabel(s.attendanceStatus, t);
                const title = String(s.sessionTitle ?? s.subject ?? t("liveClasses.session"));
                const dateLabel = formatDate(s.meetingDate);
                return (
                  <li
                    key={String(s.scheduleId ?? i)}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-sm"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-body font-medium text-foreground">{title}</span>
                      {dateLabel ? (
                        <span className="text-caption text-muted-foreground">{dateLabel}</span>
                      ) : null}
                    </div>
                    <ParentStatusChip tone={info.tone} label={info.label} />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </ModuleScaffold>
  );
}
