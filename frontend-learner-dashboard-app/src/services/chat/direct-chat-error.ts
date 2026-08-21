/**
 * Why opening a direct conversation failed, in words that match reality.
 *
 * The open-a-DM endpoint rejects with permanent codes — chat switched off for the
 * institute, or a role pair its DM matrix forbids. Telling a learner to "try again"
 * on those sends them round a loop that can never finish, so each gets its own
 * sentence and only genuinely transient failures keep the retry wording.
 *
 * Kept in its own module, free of any URL/config import, so it stays testable in
 * this app's node test environment (which has no `window`).
 */
export function describeDirectChatError(err: unknown, fallback: string): string {
  const response = (err as { response?: { status?: number; data?: { message?: string } } })
    ?.response;
  const status = response?.status;
  if (status == null || status < 400 || status >= 500) return fallback;
  const raw = response?.data?.message ?? "";
  if (raw.includes("CHAT_DISABLED")) {
    return "Messaging isn't available at your institute right now.";
  }
  if (raw.includes("DM_NOT_ALLOWED")) {
    return "Your institute doesn't allow direct messages with mentors.";
  }
  if (raw.includes("CANNOT_DM_SELF")) return "You can't message yourself.";
  if (raw.includes("TARGET_REQUIRED")) {
    return "We couldn't find this mentor's account, so a chat can't be opened.";
  }
  return fallback;
}
