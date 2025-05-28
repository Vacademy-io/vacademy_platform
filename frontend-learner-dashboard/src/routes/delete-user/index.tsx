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

export const Route = createFileRoute("/delete-user/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();

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
            className="bg-red-500 text-white"
          >
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default RouteComponent;
