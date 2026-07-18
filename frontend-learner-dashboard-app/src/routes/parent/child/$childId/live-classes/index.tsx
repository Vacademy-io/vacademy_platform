import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { VideoCamera } from "@phosphor-icons/react";
import { ModuleScaffold } from "../../-components/ModuleScaffold";
import { useChildUpcomingSessions, useChildOverview } from "../../-hooks/use-parent-child";

export const Route = createFileRoute("/parent/child/$childId/live-classes/")({
  component: LiveClassesScreen,
});

function LiveClassesScreen() {
  const { childId } = useParams({ from: "/parent/child/$childId/live-classes/" });
  const { t } = useTranslation("parent");
  const overview = useChildOverview(childId);
  const { data, isLoading, isError, refetch } = useChildUpcomingSessions(childId);

  const childName = overview.data?.child?.fullName || t("common.yourChild");
  const groups = (data ?? []) as Record<string, unknown>[];
  const total = groups.reduce((acc, g) => {
    const sessions = Array.isArray(g.sessions) ? g.sessions : [];
    return acc + sessions.length;
  }, 0);

  return (
    <ModuleScaffold
      childId={childId}
      title={t("tiles.liveClasses")}
      icon="liveSessions"
      summary={t("liveClasses.summary", { name: childName, count: total })}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
      isEmpty={total === 0}
      emptyIcon={VideoCamera}
      emptyTitle={t("liveClasses.emptyTitle")}
      emptyBody={t("liveClasses.emptyBody")}
    >
      <ul className="flex flex-col gap-4">
        {groups.map((g, gi) => {
          const sessions = Array.isArray(g.sessions) ? (g.sessions as Record<string, unknown>[]) : [];
          return (
            <li key={String(g.date ?? gi)} className="flex flex-col gap-2">
              <h3 className="text-caption font-semibold text-muted-foreground">
                {String(g.date ?? "")}
              </h3>
              {sessions.map((s, si) => (
                <div
                  key={String(s.sessionId ?? si)}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="text-body font-medium text-foreground">
                    {String(s.title ?? s.subject ?? t("liveClasses.session"))}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {String(s.startTime ?? s.scheduleStartTime ?? "")}
                  </span>
                </div>
              ))}
            </li>
          );
        })}
      </ul>
    </ModuleScaffold>
  );
}
