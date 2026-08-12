/**
 * Shared guard for the hardware/browser back action.
 *
 * Capacitor fires EVERY registered `backButton` listener — there is no
 * stopPropagation and returning false does nothing. So the global listener in
 * `__root.tsx` used to run `window.history.back()` even while the live test had
 * its own listener open a modal, which is how a learner could bounce out of a
 * running exam to the dashboard on a stray back press.
 *
 * A screen that must not be backed out of registers a guard here; the global
 * listener asks the guard first and stands down when it reports "handled".
 */

/** Returns true when the screen handled back itself and navigation must not run. */
export type BackGuard = () => boolean;

// A stack rather than a single slot: unmount order is not guaranteed to be the
// reverse of mount order, and holding a closed screen's guard would leave the
// back button dead app-wide — a much worse failure than an unguarded back.
const guards: BackGuard[] = [];

/**
 * Register the guard for the current screen. Returns an unregister function —
 * call it on unmount. The most recently registered guard wins.
 */
export function registerBackGuard(guard: BackGuard): () => void {
  guards.push(guard);

  return () => {
    const index = guards.lastIndexOf(guard);
    if (index !== -1) guards.splice(index, 1);
  };
}

/** Run the top guard, if any. True means the back action was consumed. */
export function runBackGuard(): boolean {
  const guard = guards[guards.length - 1];
  if (!guard) return false;
  try {
    return guard();
  } catch (error) {
    // A throwing guard must not strand the user with a dead back button.
    console.error("[back-guard] guard threw, allowing default back", error);
    return false;
  }
}

export function hasBackGuard(): boolean {
  return guards.length > 0;
}
