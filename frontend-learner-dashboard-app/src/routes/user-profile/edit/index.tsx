import EditProfile from "@/components/common/user-profile/user-profile-edit";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/user-profile/edit/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LayoutContainer className="!m-0 !p-0 max-w-none">
      <EditProfile />
    </LayoutContainer>
  );
}
