import type { ReactNode } from 'react';
import type { LeadCardVM } from './lead-view-model';

export type LeadTier = 'HOT' | 'WARM' | 'COLD';
export type LeadStatus = 'LEAD' | 'CONVERTED' | 'LOST';

/**
 * The single set of callbacks every leads view (list / card / board) wires up.
 * The page owns the actual side effects (open the side view, open dialogs, fire
 * the tier mutation) so dialogs stay mounted once per page.
 */
export interface LeadActionHandlers {
    /** Open the shared StudentSidebar for this lead. */
    onOpenDetails: (vm: LeadCardVM) => void;
    onAddNote?: (userId: string, userName: string) => void;
    onAssignCounsellor?: (userId: string, userName: string) => void;
    onSetTier?: (userId: string, userName: string, tier: LeadTier) => void;
    onSetStatus?: (userId: string, userName: string, status: LeadStatus) => void;
    /** Surface-specific overflow-menu items (e.g. the campaign list's Delete). */
    renderExtraActions?: (vm: LeadCardVM) => ReactNode;
}
