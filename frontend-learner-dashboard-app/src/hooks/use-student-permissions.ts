import { useQuery } from "@tanstack/react-query";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { StudentPermissions } from "@/types/student-display-settings";
import { isIOSNative } from "@/utils/ios-iap-compliance";

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

  const basePermissions: StudentPermissions = settings?.permissions || {
    canViewProfile: true,
    canEditProfile: false,
    canDeleteProfile: false,
    canViewFiles: false,
    canViewReports: false,
  };

  // Apple Guideline 5.1.1(v): an app that allows account creation MUST let
  // users delete their account from within the app. Signup is available on
  // native iOS, so the in-app delete-account flow must always be reachable
  // there — force the permission on regardless of the institute's display
  // setting (which defaults to false). Other platforms are unaffected.
  const permissions: StudentPermissions = isIOSNative()
    ? { ...basePermissions, canDeleteProfile: true }
    : basePermissions;

  return {
    permissions,
    isLoading,
    error,
    settings,
  };
}
