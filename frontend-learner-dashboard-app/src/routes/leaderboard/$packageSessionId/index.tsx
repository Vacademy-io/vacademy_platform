import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { useTheme } from "@/providers/theme/theme-provider";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import {
  fetchPublicCourseLeaderboard,
  type CourseLeaderboardData,
} from "@/services/course-leaderboard";
import { PublicLeaderboardView } from "../-components/PublicLeaderboardView";

export const Route = createFileRoute("/leaderboard/$packageSessionId/")({
  component: PublicCourseLeaderboardPage,
});

function PublicCourseLeaderboardPage() {
  const { packageSessionId } = Route.useParams();
  // Domain routing brands white-label domains; the response covers any other domain.
  const { instituteName: domainName, instituteLogoFileId: domainLogo } = useDomainRouting();
  const { setPrimaryColor } = useTheme();

  const [data, setData] = useState<CourseLeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");

  // Fetch by packageSessionId — the backend derives the institute, so this works on
  // ANY domain (generic learner.vacademy.io included), not just the white-label domain.
  useEffect(() => {
    if (!packageSessionId) {
      setError(true);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    fetchPublicCourseLeaderboard(packageSessionId)
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
  }, [packageSessionId]);

  // Branding: prefer the white-label domain, fall back to the response.
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

  // Apply the institute theme from the response so generic domains are branded too.
  useEffect(() => {
    if (themeCode) setPrimaryColor(themeCode);
  }, [themeCode, setPrimaryColor]);

  return (
    <PublicLeaderboardView
      logoUrl={logoUrl}
      instituteName={instituteName}
      subtitle={data?.courseName}
      data={data}
      loading={loading}
      error={error}
    />
  );
}
