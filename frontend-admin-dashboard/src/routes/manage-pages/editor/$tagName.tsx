import { createFileRoute } from '@tanstack/react-router';
import { CatalogueEditorPage } from '../-components/CatalogueEditorPage';

export const Route = createFileRoute('/manage-pages/editor/$tagName')({
    component: CatalogueEditorPage,
});
