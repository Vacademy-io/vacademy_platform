import { Preferences } from "@capacitor/preferences";

/**
 * Clear a session start time (e.g. on Submit). Lets a learner restart cleanly
 * if they're allowed to attempt again.
 */
export async function clearSessionTimer(slideId: string): Promise<void> {
  try {
    await Preferences.remove({ key: `coding_session_started_${slideId}` });
  } catch {
    // ignore
  }
}
