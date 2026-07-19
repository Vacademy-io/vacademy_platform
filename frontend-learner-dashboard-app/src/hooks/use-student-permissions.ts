import { useMemo } from "react";
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

  // `permissions` MUST keep a stable reference across renders. React Query
  // already keeps `settings.permissions` referentially stable, so memoizing on
  // it means this object only changes when the settings actually change.
  //
  // Without the memo, native iOS returned a brand-new
  // `{ ...base, canDeleteProfile: true }` object on EVERY render. Any consumer
  // effect keyed on `permissions` (the navbar UserMenu, the logout sidebar)
  // then re-ran every render and called setState with a fresh array, which
  // re-rendered, which produced yet another new `permissions` object — an
  // infinite render→effect→setState loop that pegged the WebView main thread.
  // That is the Profile-tab freeze Apple flagged under Guideline 2.1(a); it hit
  // iOS only because web/Android returned React Query's stable reference.
  const permissions: StudentPermissions = useMemo(() => {
    const base: StudentPermissions = settings?.permissions || {
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
    return isIOSNative() ? { ...base, canDeleteProfile: true } : base;
  }, [settings?.permissions]);

  return {
    permissions,
    isLoading,
    error,
    settings,
  };
}
