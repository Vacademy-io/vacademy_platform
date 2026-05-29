import { createFileRoute } from '@tanstack/react-router';
import { CreatePage } from '@/features/vimotion/studio/create/CreatePage';

/**
 * `/vim/studio/new` — the Studio create wizard (Ingest → Arrangement → Cuts
 * → Overlays → Audio → Build). P1 wires the Ingest step + project create;
 * later steps land in P2+.
 */
export const Route = createFileRoute('/vim/studio/new')({
    component: CreatePage,
});
