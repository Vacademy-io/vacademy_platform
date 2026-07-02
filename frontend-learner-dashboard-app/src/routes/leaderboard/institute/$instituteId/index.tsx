import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import {
  fetchPublicInstituteLeaderboard,
  type CourseLeaderboardData,
} from "@/services/course-leaderboard";
import { PublicLeaderboardView } from "../../-components/PublicLeaderboardView";

export const Route = createFileRoute("/leaderboard/institute/$instituteId/")({
  component: PublicInstituteLeaderboardPage,
});

function PublicInstituteLeaderboardPage() {
  // The institute is identified by the shared URL; branding (logo/name) comes
  // from the white-label domain the link is opened on.
  const { instituteId } = Route.useParams();
  const { instituteName, instituteLogoFileId, isLoading: brandingLoading } = useDomainRouting();

  const [logoUrl, setLogoUrl] = useState<string>("");
  const [data, setData] = useState<CourseLeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!instituteLogoFileId) return;
    let active = true;
    getPublicUrlWithoutLogin(instituteLogoFileId)
      .then((u) => active && setLogoUrl(u || ""))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [instituteLogoFileId]);

  useEffect(() => {
    if (!instituteId) {
      setError(true);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    fetchPublicInstituteLeaderboard(instituteId)
      .then((d) => {
        if (!active) return;
        if (!d) setError(true);
        setData(d);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [instituteId]);

  return (
    <PublicLeaderboardView
      logoUrl={logoUrl}
      instituteName={instituteName}
      subtitle="All courses"
      data={data}
      loading={brandingLoading || loading}
      error={error}
    />
  );
}
