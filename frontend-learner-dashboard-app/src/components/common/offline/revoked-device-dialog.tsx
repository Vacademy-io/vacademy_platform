/**
 * Blocking "this device was revoked" dialog (plan §B6). Driven by
 * `useOfflineStore().revokedDialogOpen`, set by
 * `handleDeviceRevoked` (src/lib/offline/lease/checkin.ts) once the purge
 * has already completed — this is purely a notification, there's nothing
 * left to undo, so the only action is acknowledging it.
 */

import { MyDialog } from "@/components/design-system/dialog";
import { MyButton } from "@/components/design-system/button";
import { useOfflineStore } from "@/stores/offline/use-offline-store";

export const RevokedDeviceDialog = () => {
  const revokedDialogOpen = useOfflineStore((s) => s.revokedDialogOpen);
  const setRevokedDialogOpen = useOfflineStore((s) => s.setRevokedDialogOpen);

  if (!revokedDialogOpen) return null;

  return (
    <MyDialog
      open={revokedDialogOpen}
      onOpenChange={setRevokedDialogOpen}
      heading="Offline access removed"
      dialogWidth="w-96"
    >
      <div className="flex flex-col gap-4 p-2">
        <p className="text-body text-neutral-600">
          Your institute revoked offline access for this device. All downloaded content on this device has
          been removed. You can still access everything online, and register a different device for offline
          use.
        </p>
        <MyButton buttonType="primary" onClick={() => setRevokedDialogOpen(false)}>
          Got it
        </MyButton>
      </div>
    </MyDialog>
  );
};
