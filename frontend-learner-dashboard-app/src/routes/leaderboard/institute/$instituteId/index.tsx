import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { useTheme } from "@/providers/theme/theme-provider";
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
  // The institute is in the URL, so this already works on any domain; branding comes
  // from the white-label domain when present, else from the response.
  const { instituteId } = Route.useParams();
  const { instituteName: domainName, instituteLogoFileId: domainLogo } = useDomainRouting();
  const { setPrimaryColor } = useTheme();

  const [data, setData] = useState<CourseLeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");

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

  const instituteName = domainName || data?.instituteName || null;
  const logoFileId = domainLogo || data?.instituteLogoFileId || "";
  const themeCode = data?.instituteThemeCode;

  useEffect(() => {
    if (!logoFileId) {
      setLogoUrl("");
      return;
    }
    let active = true;
    getPublicUrlWithoutLogin(logoFileId)
      .then((u) => active && setLogoUrl(u || ""))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [logoFileId]);

  useEffect(() => {
    if (themeCode) setPrimaryColor(themeCode);
  }, [themeCode, setPrimaryColor]);

  return (
    <PublicLeaderboardView
      logoUrl={logoUrl}
      instituteName={instituteName}
      subtitle="All courses"
      data={data}
      loading={loading}
      error={error}
    />
  );
}
