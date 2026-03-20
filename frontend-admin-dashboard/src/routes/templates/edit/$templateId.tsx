import { createFileRoute } from '@tanstack/react-router';
import { TemplateEditorEmail } from '@/components/templates/email/TemplateEditorEmail';

export const Route = createFileRoute('/templates/edit/$templateId')({
    component: TemplateEditPage,
});

function TemplateEditPage() {
    const { templateId } = Route.useParams();
    return <TemplateEditorEmail templateId={templateId} />;
}
