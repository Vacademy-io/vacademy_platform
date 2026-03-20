import ChangePasswordPage from "@/components/common/user-profile/change-password-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/change-password/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <ChangePasswordPage />;
}
