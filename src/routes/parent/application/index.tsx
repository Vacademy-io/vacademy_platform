import { createFileRoute } from "@tanstack/react-router";
import { ParentApplicationForm } from "../-components/ParentApplicationForm";
import { ParentPageLayout } from "../-components/ParentPageLayout";
import { useParentPortalStore } from "@/stores/parent-portal-store";

export const Route = createFileRoute("/parent/application/")({
  component: Page,
});

export default function Page() {
  const { selectedChild } = useParentPortalStore();
  return (
    <ParentPageLayout>
      <ParentApplicationForm
        onComplete={() => {}}
        destinationPackageSessionId={
          selectedChild!.destinationPackageSessionId!
        }
        child={selectedChild!}
      />
    </ParentPageLayout>
  );
}
