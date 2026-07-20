import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Medal } from "@phosphor-icons/react";
import { ModuleScaffold } from "../../-components/ModuleScaffold";
import { useChildBadges, useChildOverview } from "../../-hooks/use-parent-child";

export const Route = createFileRoute("/parent/child/$childId/rewards/")({
  component: RewardsScreen,
});

function RewardsScreen() {
  const { childId } = useParams({ from: "/parent/child/$childId/rewards/" });
  const { t } = useTranslation("parent");
  const overview = useChildOverview(childId);
  const { data: badges, isLoading, isError, refetch } = useChildBadges(childId);

  const childName = overview.data?.child?.fullName || t("common.yourChild");
  const count = badges?.length ?? 0;

  return (
    <ModuleScaffold
      childId={childId}
      title={t("tiles.rewards")}
      icon="rewards"
      summary={t("rewards.summary", { name: childName, count })}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => refetch()}
      isEmpty={count === 0}
      emptyIcon={Medal}
      emptyTitle={t("rewards.emptyTitle")}
      emptyBody={t("rewards.emptyBody")}
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badges?.map((b, i) => (
          <li
            key={String(b.id ?? b.badgeId ?? i)}
            className="flex flex-col items-center gap-2 rounded-2xl bg-card shadow-sm p-4 text-center"
          >
            <Medal weight="duotone" className="size-10 text-primary-400" aria-hidden />
            <span className="text-caption font-medium text-foreground">
              {String(b.badgeName ?? b.name ?? t("rewards.badge"))}
            </span>
          </li>
        ))}
      </ul>
    </ModuleScaffold>
  );
}
