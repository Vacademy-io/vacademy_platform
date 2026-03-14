import { createLazyFileRoute } from "@tanstack/react-router"
import { LayoutContainer } from "@/components/common/layout-container/layout-container"
import CollectionDashboardMain from "./-components/CollectionDashboardMain"

export const Route = createLazyFileRoute("/financial-management/collection-dashboard/")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <LayoutContainer>
      <div className="flex-1 p-6 bg-[#FAFAFA] min-h-screen">
        <CollectionDashboardMain />
      </div>
    </LayoutContainer>
  )
}
