import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useStudentPermissions } from "@/hooks/use-student-permissions";
import { useParentPortalSwitch } from "@/hooks/use-parent-portal-switch";
import { getPublicUrl } from "@/services/upload_file";
import { cn, isNullOrEmptyOrUndefined } from "@/lib/utils";
import { Student } from "@/types/user/user-detail";
import { RoleTerms, SystemTerms } from "@/types/naming-settings";
import {
  HamBurgerSidebarItemsData,
  filterHamburgerMenuItemsWithPermissions,
  getTerminology,
} from "../sidebar/utils";

/**
 * Friendlier menu labels for a compact dropdown; falls back to the
 * canonical hamburger item title when a route has no override.
 */
const MENU_LABEL_OVERRIDES: Record<string, string> = {
  "/user-profile": "Profile",
};

/**
 * Navbar avatar + account dropdown: THE identity surface of the shell.
 * Reuses the hamburger menu's permission-filtered items and the existing
 * /logout route flow (the route performs all token clearing).
 */
export const UserMenu = ({ className }: { className?: string }) => {
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
  const [filteredItems, setFilteredItems] = useState(HamBurgerSidebarItemsData);

  // Permission-filtered account items — same source of truth as the
  // hamburger sheet so visibility rules stay in one place.
  useEffect(() => {
    if (isNullOrEmptyOrUndefined(permissions)) return;
    filterHamburgerMenuItemsWithPermissions(
      HamBurgerSidebarItemsData,
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

  // Account navigation items, minus the destructive ones which get their
  // own grouping below the separator.
  const navItems = filteredItems.filter(
    (item) => item.to !== "/logout" && item.to !== "/delete-user",
  );
  const deleteAccountItem = filteredItems.find(
    (item) => item.to === "/delete-user",
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open account menu"
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
            {MENU_LABEL_OVERRIDES[item.to ?? ""] ?? item.title}
          </DropdownMenuItem>
        ))}

        {parentPortalTarget && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate({ to: parentPortalTarget as never })}>
              <UserSwitch />
              Switch to parent portal
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => navigate({ to: "/logout" })}
          className="text-destructive focus:text-destructive"
        >
          <SignOut />
          Log out
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
