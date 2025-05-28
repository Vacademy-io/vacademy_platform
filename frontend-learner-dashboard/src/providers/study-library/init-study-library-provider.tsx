import { DashboardLoader } from "@/components/core/dashboard-loader";
import { useStudyLibraryQuery } from "@/services/study-library/getStudyLibraryDetails";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { useQuery } from "@tanstack/react-query";

export const InitStudyLibraryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // First query to get the package session ID
  const { data: packageSessionId, isLoading: isLoadingPackageId } = useQuery({
    queryKey: ["packageSessionId"],
    queryFn: getPackageSessionId,
  });

  // Main query for modules with chapters
  const { isLoading: isLoadingInitStudyLibrary } = useQuery({
    ...useStudyLibraryQuery(packageSessionId),
    enabled: !!packageSessionId, // Only run when packageSessionId is available
  });

  const isLoading = isLoadingInitStudyLibrary || isLoadingPackageId;

  return <div>{isLoading ? <DashboardLoader /> : children}</div>;
};
