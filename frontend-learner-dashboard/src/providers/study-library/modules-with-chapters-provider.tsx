// CallInitStudyLibraryIfNull.tsx
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { useModulesWithChaptersQuery } from "@/services/study-library/getModulesWithChapters";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { useQuery } from "@tanstack/react-query";

export const ModulesWithChaptersProvider = ({
  subjectId,
  children,
}: {
  subjectId: string;
  children: React.ReactNode;
}) => {
  // First query to get the package session ID
  const { data: packageSessionId, isLoading: isLoadingId } = useQuery({
    queryKey: ["packageSessionId"],
    queryFn: getPackageSessionId,
  });

  // Main query for modules with chapters
  const { isLoading: isLoadingModules } = useQuery({
    ...useModulesWithChaptersQuery(subjectId, packageSessionId),
    enabled: !!packageSessionId, // Only run when packageSessionId is available
  });

  const isLoading = isLoadingId || isLoadingModules;

  return <div>{isLoading ? <DashboardLoader /> : children}</div>;
};
