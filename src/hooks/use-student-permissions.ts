import { useQuery } from "@tanstack/react-query";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { StudentPermissions } from "@/types/student-display-settings";

export function useStudentPermissions() {
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["studentDisplaySettings"],
    queryFn: () => getStudentDisplaySettings(false),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const permissions: StudentPermissions = settings?.permissions || {
    canViewProfile: false,
    canEditProfile: false,
    canDeleteProfile: false,
    canViewFiles: false,
    canViewReports: false,
  };

  return {
    permissions,
    isLoading,
    error,
    settings,
  };
}
