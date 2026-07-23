import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Medal, Star } from "@phosphor-icons/react";
import { ModuleScaffold } from "../../-components/ModuleScaffold";
import { useChildBadges, useChildPoints, useChildOverview } from "../../-hooks/use-parent-child";

export const Route = createFileRoute("/parent/child/$childId/rewards/")({
  component: RewardsScreen,
});

function RewardsScreen() {
  const { childId } = useParams({ from: "/parent/child/$childId/rewards/" });
  const { t } = useTranslation("parent");
  const overview = useChildOverview(childId);
  const { data: badges, isLoading, isError, refetch } = useChildBadges(childId);
  const { data: points } = useChildPoints(childId);

  const childName = overview.data?.child?.fullName || t("common.yourChild");
  const count = badges?.length ?? 0;
  const pointsValue = points?.points ?? 0;

  return (
    <ModuleScaffold
      childId={childId}
      title={t("tiles.rewards")}
      icon="rewards"
      summary={t("rewards.summary", { name: childName, count })}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
      isEmpty={count === 0 && pointsValue === 0}
      emptyIcon={Medal}
      emptyTitle={t("rewards.emptyTitle")}
      emptyBody={t("rewards.emptyBody")}
    >
      <div className="flex flex-col gap-5">
        {/* Points earned + rank */}
        {points ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-card px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cp-gold-tint">
                <Star weight="fill" className="size-6 text-cp-gold" aria-hidden />
              </span>
              <div className="flex flex-col">
                <span className="text-h2 font-bold tabular-nums text-foreground">{pointsValue}</span>
                <span className="text-caption text-muted-foreground">{t("rewards.points")}</span>
              </div>
            </div>
            {points.rank != null ? (
              <span className="rounded-full bg-primary-50 px-3 py-1 text-caption font-semibold text-primary-500">
                {t("rewards.rank", { value: points.rank })}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Badges */}
        {count > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {badges?.map((b, i) => (
              <li
                key={String(b.id ?? b.badgeId ?? i)}
                className="flex flex-col items-center gap-2 rounded-2xl bg-card p-4 text-center shadow-sm"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-cp-gold-tint">
                  <Medal weight="fill" className="size-8 text-cp-gold" aria-hidden />
                </span>
                <span className="text-caption font-medium text-foreground">
                  {String(b.badgeName ?? b.name ?? t("rewards.badge"))}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </ModuleScaffold>
  );
}
