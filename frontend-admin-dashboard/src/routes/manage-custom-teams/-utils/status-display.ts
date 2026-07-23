/**
 * Generic status display helpers for the Manage-VLEs / registration surfaces.
 * Both the label and the colour are DERIVED from the raw enum value — nothing is
 * hardcoded per status — so new backend statuses render sensibly with no changes here.
 */

/** Title-case a backend enum value for display: PENDING_PAYMENT -> "Pending Payment". */
export const humanizeStatus = (value?: string | null): string =>
    value
        ? value
              .split(/[_\s]+/)
              .filter(Boolean)
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ')
        : '';

/**
 * Tinted outline chip classes for any status — keyword-based, so it colours new
 * statuses without maintaining an exhaustive per-value map.
 */
export const statusToneClass = (value?: string | null): string => {
    const v = (value || '').toUpperCase();
    // Negatives are checked FIRST on purpose: e.g. "INACTIVE" contains the substring
    // "ACTIVE", so the success rule must not get to claim it.
    if (/FAIL|EXPIR|CANCEL|TERMINAT|DENIED|REJECT|INACTIVE|DISABLED|ERROR/.test(v)) {
        return 'border-danger-400 bg-danger-50 text-danger-600';
    }
    if (/COMPLETED|ACTIVE|VERIFIED|SUCCESS|APPROVED|PAID|ENABLED/.test(v)) {
        return 'border-success-400 bg-success-50 text-success-600';
    }
    if (/PENDING|PROCESS|REVIEW|WAIT|PARTIAL/.test(v)) {
        return 'border-warning-400 bg-warning-50 text-warning-600';
    }
    return 'border-neutral-300 bg-neutral-50 text-neutral-600';
};
