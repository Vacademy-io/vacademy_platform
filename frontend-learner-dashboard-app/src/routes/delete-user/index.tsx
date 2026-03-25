import { UPDATE_ROLE } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { removeTokensAndLogout } from "@/lib/auth/sessionUtility";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Preferences } from "@capacitor/preferences";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useStudentPermissions } from "@/hooks/use-student-permissions";
import { useEffect } from "react";

export const Route = createFileRoute("/delete-user/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { permissions, isLoading: permissionsLoading } = useStudentPermissions();

  // Redirect if user doesn't have permission to delete profile
  useEffect(() => {
    if (!permissionsLoading && !permissions.canDeleteProfile) {
      navigate({ to: "/dashboard" });
    }
  }, [permissions.canDeleteProfile, permissionsLoading, navigate]);

  const handleDeleteAccount = async () => {
    try {
      const studentDetailsString = await Preferences.get({
        key: "StudentDetails",
      });
      const instituteDetailsString = await Preferences.get({
        key: "InstituteDetails",
      });

      const studentDetails = studentDetailsString.value
        ? JSON.parse(studentDetailsString.value)
        : {};
      const institute = instituteDetailsString.value
        ? JSON.parse(instituteDetailsString.value)
        : {};

      const studentId = studentDetails.user_id;

      const response = await authenticatedAxiosInstance.put(
        `${UPDATE_ROLE}`,
        [studentId],
        {
          params: {
            instituteId: institute.id,
            status: "DELETED",
          },
        }
      );

      removeTokensAndLogout();
      if (response.status === 200) {
        toast.success("Your account deleted successfully");
        navigate({ to: "/login" });
      } else {
        toast.error("Failed to update user role status");
      }
    } catch {
      removeTokensAndLogout();
      navigate({ to: "/login" });
      toast.error("Failed to update user role status");
    }
  };

  // Show loading while checking permissions
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Don't render if user doesn't have permission
  if (!permissions.canDeleteProfile) {
    return null;
  }

  return (
    <AlertDialog open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <h2 className="text-lg font-semibold">Delete Account</h2>
          <p>
            Are you sure you want to permanently delete your account? This
            action cannot be undone.
          </p>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => navigate({ to: "/dashboard" })}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAccount}
            className="text-white"
          >
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default RouteComponent;
