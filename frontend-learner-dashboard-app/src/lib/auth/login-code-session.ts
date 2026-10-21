/**
 * Session-storage key holding the user id of the session a ?lc= login code just created
 * (set by __root's beforeLoad before it reloads the page). Username landing pages read it
 * once to tell a code-made session apart from one left on the device by someone else.
 * Lives here, not in __root, so routes can import it without a circular import.
 */
export const LOGIN_CODE_USER_KEY = "lc_session_user";
