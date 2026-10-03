import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SignOut, UserSwitch } from "@phosphor-icons/react";
import { Preferences } from "@capacitor/preferences";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOfflineAvailable } from "@/hooks/offline/use-offline-availability";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useStudentPermissions } from "@/hooks/use-student-permissions";
import { useParentPortalSwitch } from "@/hooks/use-parent-portal-switch";
import { getPublicUrl } from "@/services/upload_file";
import { isOnboardingEnabled } from "@/services/onboarding-settings";
import { cn, isNullOrEmptyOrUndefined } from "@/lib/utils";
import { Student } from "@/types/user/user-detail";
import { RoleTerms, SystemTerms } from "@/types/naming-settings";
import {
  getHamBurgerSidebarItemsData,
  stripOfflineEntries,
  filterHamburgerMenuItemsWithPermissions,
  getTerminology,
} from "../sidebar/utils";

/**
 * Navbar avatar + account dropdown: THE identity surface of the shell.
 * Reuses the hamburger menu's permission-filtered items and the existing
 * /logout route flow (the route performs all token clearing).
 */
export const UserMenu = ({ className }: { className?: string }) => {
  const { t } = useTranslation("layoutCommonA");
  const navigate = useNavigate();
  const { permissions } = useStudentPermissions();
  // Any student may hop to the parent perspective when Guardian Settings allow
  // it: dual-role users to their real portal, plain students to the parent-style
  // view of themselves (guard self-leg).
  const parentPortalTarget = useParentPortalSwitch();

  const [studentData, setStudentData] = useState<Student | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(
    undefined,
  );
  const [filteredItems, setFilteredItems] = useState(() =>
    getHamBurgerSidebarItemsData(t),
  );
  const offlineAvailable = useOfflineAvailable();

  // Institute-wide feature toggle (ONBOARDING_SETTING, same one the admin
  // dashboard's sidebar entry gates on) — the menu item exists for every
  // institute, so it must be hidden unless the institute has actually turned
  // the feature on.
  const { data: onboardingEnabled } = useQuery({
    queryKey: ["onboarding-setting-enabled"],
    queryFn: () => isOnboardingEnabled(),
    staleTime: 5 * 60 * 1000,
  });

  // Permission-filtered account items — same source of truth as the
  // hamburger sheet so visibility rules stay in one place.
  useEffect(() => {
    if (isNullOrEmptyOrUndefined(permissions)) return;
    filterHamburgerMenuItemsWithPermissions(
      getHamBurgerSidebarItemsData(t),
      permissions || {
        canViewProfile: false,
        canEditProfile: false,
        canDeleteProfile: false,
        canViewFiles: false,
        canViewReports: false,
      },
    ).then((data) => {
      setFilteredItems(data);
    });
  }, [permissions]);

  // Student identity for the avatar + menu header (same storage the
  // hamburger sheet reads).
  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const { value } = await Preferences.get({ key: "StudentDetails" });
        if (!value) return;

        const parsedData = JSON.parse(value);
        let studentDetails: Student;
        if (Array.isArray(parsedData)) {
          if (parsedData.length === 0) return;
          studentDetails = parsedData[0];
        } else if (typeof parsedData === "object" && parsedData !== null) {
          studentDetails = parsedData;
        } else {
          console.error("Unexpected data format:", parsedData);
          return;
        }

        setStudentData(studentDetails);

        if (studentDetails.face_file_id) {
          try {
            const imageUrl = await getPublicUrl(studentDetails.face_file_id);
            setProfileImageUrl(imageUrl);
          } catch (error) {
            console.error("Error fetching profile image:", error);
          }
        }
      } catch (error) {
        console.error("Error reading student data from Preferences:", error);
      }
    };

    fetchStudentData();
  }, []);

  const initials = useMemo(() => {
    const words = (studentData?.full_name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return "U";
    const first = words[0]?.charAt(0) ?? "";
    const last =
      words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? "") : "";
    return (first + last).toUpperCase() || "U";
  }, [studentData?.full_name]);

  const displayName =
    studentData?.full_name ||
    getTerminology(RoleTerms.Learner, SystemTerms.Learner);
  const displayEmail = studentData?.email || studentData?.username || "";

  // Friendlier menu labels for a compact dropdown; falls back to the
  // canonical hamburger item title when a route has no override.
  const menuLabelOverrides: Record<string, string> = {
    "/user-profile": t("userMenu.profileLabel"),
  };

  // Account navigation items, minus the destructive ones which get their
  // own grouping below the separator.
  // Offline is native-only AND admin-gated, so its entry must disappear here
  // too — this dropdown renders the same list as the hamburger sheet, and
  // filtering only the sidebar left the item reachable from the top navbar.
  const accountItems =
    offlineAvailable === true ? filteredItems : stripOfflineEntries(filteredItems);
  const navItems = accountItems.filter(
    (item) =>
      item.to !== "/logout" &&
      item.to !== "/delete-user" &&
      (item.id !== "onboarding" || onboardingEnabled === true),
  );
  const deleteAccountItem = accountItems.find(
    (item) => item.to === "/delete-user",
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("userMenu.openAccountMenu")}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            "transition-colors duration-200 hover:bg-primary-50 dark:hover:bg-neutral-700",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            className,
          )}
        >
          <Avatar className="h-8 w-8 [.ui-play_&]:ring-2 [.ui-play_&]:ring-primary/20">
            {profileImageUrl && (
              <AvatarImage src={profileImageUrl} alt={displayName} />
            )}
            <AvatarFallback className="bg-primary-100 text-xs font-semibold text-primary-500">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold text-foreground">
            {displayName}
          </p>
          {displayEmail && (
            <p className="truncate text-caption text-muted-foreground">
              {displayEmail}
            </p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {navItems.map((item) => (
          <DropdownMenuItem
            key={item.title}
            onSelect={() => {
              if (item.to) navigate({ to: item.to as never });
            }}
          >
            <item.icon />
            {menuLabelOverrides[item.to ?? ""] ?? item.title}
          </DropdownMenuItem>
        ))}

        {parentPortalTarget && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate({ to: parentPortalTarget as never })}>
              <UserSwitch />
              {t("userMenu.switchToParentPortal")}
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => navigate({ to: "/logout" })}
          className="text-destructive focus:text-destructive"
        >
          <SignOut />
          {t("common.logOut")}
        </DropdownMenuItem>
        {deleteAccountItem && (
          <DropdownMenuItem
            onSelect={() => navigate({ to: "/delete-user" as never })}
            className="text-destructive focus:text-destructive"
          >
            <deleteAccountItem.icon />
            {deleteAccountItem.title}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
