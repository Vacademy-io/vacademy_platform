import EditProfile from "@/components/common/user-profile/user-profile-edit";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/user-profile/edit/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <EditProfile />
}
