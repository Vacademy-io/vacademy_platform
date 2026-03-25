import { createFileRoute } from "@tanstack/react-router";
import { ParentDashboard } from "../-components/ParentDashboard";
import { ParentPageLayout } from "../-components/ParentPageLayout";
import { useParentPortalStore } from "@/stores/parent-portal-store";

export const Route = createFileRoute("/parent/dashboard/")({
  component: Page,
});

export default function Page() {
  const selectedChild = useParentPortalStore((state) => state.selectedChild);

  if (!selectedChild) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No child selected</p>
      </div>
    );
  }

  return (
    <ParentPageLayout>
      <ParentDashboard child={selectedChild} onNavigate={() => {}} />
    </ParentPageLayout>
  );
}
