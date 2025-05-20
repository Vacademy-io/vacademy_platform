import ProfilePage from "@/components/common/user-profile/user-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/user-profile/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <ProfilePage />;
}
