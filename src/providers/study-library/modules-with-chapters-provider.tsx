// CallInitStudyLibraryIfNull.tsx
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { useModulesWithChaptersQuery } from "@/services/study-library/getModulesWithChapters";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { useQuery } from "@tanstack/react-query";

export const ModulesWithChaptersProvider = ({
  subjectId,
  packageSessionId: packageSessionIdFromUrl,
  children,
}: {
  subjectId: string;
  /** When navigating from course-details, pass sessionId from URL so modules load without relying on Preferences */
  packageSessionId?: string | null;
  children: React.ReactNode;
}) => {
  // Prefer packageSessionId from URL/props (set on course-details from course-init); fallback to Preferences
  const { data: packageSessionIdFromStore, isLoading: isLoadingId } = useQuery({
    queryKey: ["packageSessionId"],
    queryFn: getPackageSessionId,
  });

  const packageSessionId =
    packageSessionIdFromUrl ?? packageSessionIdFromStore ?? undefined;

  // Main query for modules with chapters
  const { isLoading: isLoadingModules } = useQuery({
    ...useModulesWithChaptersQuery(subjectId, packageSessionId),
    enabled: !!packageSessionId && !!subjectId,
  });

  const isLoading =
    !packageSessionIdFromUrl && isLoadingId ? isLoadingId : isLoadingModules;

  return <div>{isLoading ? <DashboardLoader /> : children}</div>;
};
