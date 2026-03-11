import { createLazyFileRoute } from "@tanstack/react-router"
import { LayoutContainer } from "@/components/common/layout-container/layout-container"
import FeeManagementMain from "./-components/FeeManagementMain"

export const Route = createLazyFileRoute("/financial-management/fee-plans/")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <LayoutContainer>
      <div className="flex-1 p-6 bg-[#FAFAFA] min-h-screen">
        <FeeManagementMain />
      </div>
    </LayoutContainer>
  )
}
