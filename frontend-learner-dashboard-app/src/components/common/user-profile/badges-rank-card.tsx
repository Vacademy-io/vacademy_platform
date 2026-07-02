import React, { useEffect, useState } from "react";
import { Trophy, Crown, Buildings } from "@phosphor-icons/react";
import { BadgeVisual } from "@/routes/dashboard/-components/badge-icons";
import { getCachedGamification, type PlayBadge } from "@/services/play-gamification";
import { fetchLearnerSummary, fetchMyInstituteRank } from "@/services/course-leaderboard";
import { getBadgesEnabled } from "@/services/badge-config";
import { getInstituteId } from "@/constants/helper";

/**
 * Learner-profile "Badges & Rank" card. Shows the learner's earned badge
 * collection (reusing the dashboard-computed gamification cache — auto-unlocked
 * + admin-awarded) plus their best course rank (from the leaderboard summary).
 */
export const BadgesRankCard: React.FC = () => {
  const [badges, setBadges] = useState<{ name: string; icon: string }[]>([]);
  const [count, setCount] = useState(0);
  const [bestRank, setBestRank] = useState<number | null>(null);
  const [instituteRank, setInstituteRank] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // Institute disabled the badges feature → don't render the card.
      if (!(await getBadgesEnabled())) {
        if (active) {
          setHidden(true);
          setLoaded(true);
        }
        return;
      }
      const instituteId = await getInstituteId();

      // Prefer the dashboard-computed badge collection (auto-unlocked + awarded).
      let list: { name: string; icon: string }[] = [];
      let total = 0;
      if (instituteId) {
        const cached = getCachedGamification(instituteId);
        const unlocked = (cached?.badges ?? []).filter((b: PlayBadge) => b.unlocked);
        if (unlocked.length) {
          list = unlocked.map((b) => ({ name: b.name, icon: b.icon }));
          total = unlocked.length;
        }
      }

      const [summary, instituteStanding] = await Promise.all([
        fetchLearnerSummary(),
        fetchMyInstituteRank(),
      ]);
      if (!active) return;

      // Fall back to the server's awarded badges if the dashboard cache is empty.
      if (!list.length && summary?.badges?.length) {
        list = summary.badges.map((b) => ({ name: b.name, icon: b.icon }));
        total = summary.totalBadges;
      }

      setBadges(list.slice(0, 12));
      setCount(total);
      setBestRank(summary?.bestRank ?? null);
      setInstituteRank(instituteStanding?.rank ?? null);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Feature disabled, or nothing earned yet and no rank → hide the card entirely.
  if (hidden) return null;
  if (loaded && count === 0 && bestRank == null && instituteRank == null) return null;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Trophy weight="fill" className="h-5 w-5 text-warning-500" />
        <h3 className="text-body font-semibold text-foreground">Badges &amp; Rank</h3>
      </div>

      <div className="flex items-center gap-3">
        <div>
          <p className="text-h2 font-bold text-foreground">{count}</p>
          <p className="text-caption text-muted-foreground">
            badge{count === 1 ? "" : "s"} earned
          </p>
        </div>
        {bestRank != null && (
          <div className="flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-2">
            <Crown weight="fill" className="h-4 w-4 text-warning-500" />
            <div>
              <p className="text-body font-bold text-primary-600">#{bestRank}</p>
              <p className="text-caption text-muted-foreground">best rank</p>
            </div>
          </div>
        )}
        {instituteRank != null && (
          <div className="flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-2">
            <Buildings weight="fill" className="h-4 w-4 text-primary-500" />
            <div>
              <p className="text-body font-bold text-primary-600">#{instituteRank}</p>
              <p className="text-caption text-muted-foreground">institute rank</p>
            </div>
          </div>
        )}
      </div>

      {badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {badges.map((b, i) => (
            <span
              key={i}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50"
              title={b.name}
            >
              <BadgeVisual icon={b.icon} fill size={20} className="text-primary-500" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
