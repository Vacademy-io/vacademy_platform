import { useState } from 'react';

/**
 * Browser / password-manager autofill suppression.
 *
 * Admin screens are full of credential-shaped fields that are NOT logins — the
 * learner username + password we generate on "Enroll", the "Edit credentials"
 * dialog, provider API keys under Settings. Chrome happily drops the admin's own
 * saved vacademy password into those, which then gets saved onto the learner.
 *
 * Two things are needed to stop it:
 *
 *  1. `autocomplete`. Chrome ignores `off` on anything it classifies as a
 *     credential field; the only token it honours is `new-password`, which marks
 *     the field as part of a "create account" form rather than a login, so the
 *     saved-credential dropdown never appears. Plain text fields sitting next to
 *     one still take `off`.
 *  2. `data-*` opt-outs. 1Password / LastPass / Dashlane / Bitwarden ignore the
 *     standard attribute entirely and go by their own flags.
 *
 * Use `noAutofillProps()` on every credential-shaped input that is not the real
 * login form. The real login form must keep `username` / `current-password` so
 * password managers still work there.
 */

/** Flags the third-party password managers look for. */
export const passwordManagerIgnoreAttrs = {
    'data-lpignore': 'true',
    'data-1p-ignore': 'true',
    'data-bwignore': 'true',
    'data-form-type': 'other',
} as const;

/**
 * Full attribute bundle for an input that must never be autofilled.
 *
 * @param kind `'password'` for anything rendered as `type="password"` (or a
 *  reveal-toggled secret), `'text'` for the plain fields beside it.
 */
export const noAutofillProps = (kind: 'text' | 'password' = 'text') => ({
    autoComplete: kind === 'password' ? 'new-password' : 'off',
    ...passwordManagerIgnoreAttrs,
    spellCheck: false,
});

/**
 * `true` when the given autocomplete token means "do not fill this", i.e. when
 * the password-manager opt-out flags should ride along.
 */
export const isAutofillSuppressed = (token?: string) => token === 'off' || token === 'new-password';

/**
 * Hardest guard available: Chrome will not autofill a `readonly` input, so the
 * field stays read-only until the user actually focuses it. Spread the result
 * onto an input. Only worth reaching for on a real username+password pair, where
 * Chrome's heuristics are most aggressive. Callers that need their own
 * focus/blur handlers must compose them with the ones returned here.
 */
export const useAutofillGuard = () => {
    const [readOnly, setReadOnly] = useState(true);
    return {
        readOnly,
        onFocus: () => setReadOnly(false),
        onBlur: () => setReadOnly(true),
    };
};
