import ProfilePage from "@/components/common/user-profile/user-page";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/user-profile/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LayoutContainer className="!m-0 !p-0 max-w-none">
      <ProfilePage />
    </LayoutContainer>
  );
}
