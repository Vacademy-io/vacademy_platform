/**
 * SaveConflictNotice — non-blocking strip shown when a save aborted on a
 * timeline revision conflict (HTTP 409): another tab/session changed this
 * video since it was opened. Unsaved edits remain in memory; the user picks
 * how to continue rather than being force-reloaded.
 *
 *  - "Save anyway" — refetch the live revision and retry, overwriting the
 *    other session's changes with this tab's version (user-initiated
 *    last-writer-wins).
 *  - "Discard & load latest" — drop local edits and take the server version.
 *
 * Driven entirely by `saveConflict` in the editor store (set by saveChanges).
 */
import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useVideoEditorStore, TIMELINE_CONFLICT_MESSAGE } from './stores/video-editor-store';

export function SaveConflictNotice() {
    const saveConflict = useVideoEditorStore((s) => s.saveConflict);
    const saveAnyway = useVideoEditorStore((s) => s.saveAnyway);
    const reloadFromServer = useVideoEditorStore((s) => s.reloadFromServer);
    const [busy, setBusy] = useState<'save' | 'reload' | null>(null);

    if (!saveConflict) return null;

    const handleSaveAnyway = async () => {
        setBusy('save');
        try {
            await saveAnyway();
            // saveAnyway clears saveConflict on success; if it's still set the
            // timeline changed again mid-resolve and the strip stays up.
            if (!useVideoEditorStore.getState().saveConflict) {
                toast.success('Saved — your version is now live');
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Save failed');
        } finally {
            setBusy(null);
        }
    };

    const handleReload = async () => {
        setBusy('reload');
        try {
            await reloadFromServer();
            toast.success('Loaded the latest version');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Reload failed');
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
            <p className="flex-1 text-[11px] leading-snug text-amber-800">
                {TIMELINE_CONFLICT_MESSAGE}
            </p>
            <button
                type="button"
                onClick={handleReload}
                disabled={busy !== null}
                className="shrink-0 rounded border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
                {busy === 'reload' ? (
                    <Loader2 className="size-3 animate-spin" />
                ) : (
                    'Discard & load latest'
                )}
            </button>
            <button
                type="button"
                onClick={handleSaveAnyway}
                disabled={busy !== null}
                className="shrink-0 rounded bg-amber-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
                {busy === 'save' ? <Loader2 className="size-3 animate-spin" /> : 'Save anyway'}
            </button>
        </div>
    );
}
