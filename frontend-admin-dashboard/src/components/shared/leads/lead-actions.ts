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
    /** `responseId` is the audience_response_id — required to schedule a follow-up via
     *  POST /v1/lead-followup. Without it the Follow Up tab in the dialog is disabled. */
    onAddNote?: (userId: string, userName: string, responseId?: string) => void;
    onAssignCounsellor?: (userId: string, userName: string) => void;
    onSetTier?: (userId: string, userName: string, tier: LeadTier) => void;
    onSetStatus?: (userId: string, userName: string, status: LeadStatus) => void;
    /** Place an outbound call to this lead — wired through usePlaceCall().
     *  Optional preferredNumberId comes from the runtime ExoPhone picker
     *  (multi-ExoPhone institutes). Omit to let the backend's selector
     *  strategy decide. */
    onCallLead?: (vm: LeadCardVM, preferredNumberId?: string) => void;
    /** Decides whether the Call button is rendered/enabled for this lead.
     *  Reason is shown as a tooltip when allowed=false (e.g. "No phone on file"). */
    canCall?: (vm: LeadCardVM) => { allowed: boolean; reason?: string };
    /** Surface-specific overflow-menu items (e.g. the campaign list's Delete). */
    renderExtraActions?: (vm: LeadCardVM) => ReactNode;
}
