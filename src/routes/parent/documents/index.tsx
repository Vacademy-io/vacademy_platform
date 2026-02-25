import { createFileRoute } from "@tanstack/react-router";
import { DocumentsModule } from "../-components/DocumentsModule";
import type { ChildProfile } from "@/types/parent-portal";

export const Route = createFileRoute("/parent/documents/")({
  component: Page,
});

export default function Page() {
  const placeholderChild: ChildProfile = {
    id: "",
    student_id: "",
    parent_id: "",
    full_name: "Loading...",
    grade_applying: "",
    admission_status: "INQUIRY_SUBMITTED",
    institute_id: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return <DocumentsModule child={placeholderChild} />;
}
