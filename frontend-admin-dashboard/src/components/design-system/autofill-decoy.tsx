/**
 * Hidden username + password pair that absorbs the browser's autofill.
 *
 * Chrome fills the FIRST credential-shaped pair it finds in a form, so putting a
 * throwaway pair above the real fields keeps the real ones empty even when the
 * heuristics override `autocomplete`. Render it once, as the first child of any
 * dialog/form that asks for a username and password that are not a login.
 *
 * Pair it with `noAutofillProps()` on the real inputs — see `@/lib/no-autofill`.
 */
export const AutofillDecoy = () => (
    <div aria-hidden className="pointer-events-none size-0 overflow-hidden opacity-0">
        <input type="text" tabIndex={-1} autoComplete="username" name="fake-username" />
        <input type="password" tabIndex={-1} autoComplete="current-password" name="fake-password" />
    </div>
);
