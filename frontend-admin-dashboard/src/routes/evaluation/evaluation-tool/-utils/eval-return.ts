// Lets a caller (e.g. the assessment-slide submissions panel) record where the
// admin launched the evaluation tool from, so the tool can return there after
// submitting — instead of the hardcoded assessment-details redirect. Single-tab
// admin flow, so sessionStorage is enough.

const EVAL_RETURN_KEY = 'EVAL_RETURN_URL';

export const stashEvalReturnUrl = (url: string) => {
    try {
        sessionStorage.setItem(EVAL_RETURN_KEY, url);
    } catch {
        // ignore — falls back to the default redirect
    }
};

export const readEvalReturnUrl = (): string | null => {
    try {
        return sessionStorage.getItem(EVAL_RETURN_KEY);
    } catch {
        return null;
    }
};

export const clearEvalReturnUrl = () => {
    try {
        sessionStorage.removeItem(EVAL_RETURN_KEY);
    } catch {
        // ignore
    }
};
