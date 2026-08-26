import type { FieldValue } from '../-types/product-page-types';

/**
 * Picks out the learner's OWN email / phone / name from a submitted form.
 *
 * These three are special: everything else on the form is stored as a custom
 * field value, but these become the user account (`user_details.email`,
 * `username`, `mobile_number`, `full_name`). Getting one wrong does not show up
 * as a validation error — it silently creates an account under the wrong
 * identity, exactly the way a form field named `phone` once produced learners
 * with no mobile number at all.
 *
 * Each call site used to do its own `values.find(v => v.name.includes('email'))`,
 * which has two failure modes on a real form:
 *
 *  - **"School Name" contains "name".** iThinkers' checkout collects School
 *    Name alongside Full Name, and nothing on that form carries an explicit
 *    order — so whether the account got the child's name or the school's came
 *    down to which field the API happened to return first.
 *  - **`find` returns the first MATCH, not the first ANSWER.** With more than
 *    one email field on a form it could pick the blank one and enrol the
 *    learner with an empty email *and* an empty username.
 *
 * So the rules here are: a field whose storage KEY is the platform's key beats
 * any guess made from an admin-authored label, and a field the visitor actually
 * filled in beats an empty one.
 */

/** Institute-scoped copies are the platform key plus a suffix: `email_inst_<id>`. */
const hasKey = (value: FieldValue, keys: string[]): boolean => {
    const key = (value.key ?? '').trim().toLowerCase();
    if (!key) return false;
    return keys.some((k) => key === k || key.startsWith(`${k}_inst_`));
};

const label = (value: FieldValue): string => (value.name ?? '').toLowerCase();
const kind = (value: FieldValue): string => (value.type ?? '').toLowerCase();

const EMAIL_KEYS = ['email'];
const PHONE_KEYS = ['phone_number', 'mobile_number', 'phone', 'mobile'];
const NAME_KEYS = ['full_name', 'learner_name', 'student_name', 'name'];

/**
 * Words that turn a "… Name" label into somebody/something ELSE's name. Without
 * this list every one of them reads as a candidate for the learner's own name.
 */
const NOT_THE_LEARNER = [
    'school', 'institute', 'college', 'university', 'academy', 'centre', 'center',
    'company', 'organisation', 'organization', 'branch', 'course', 'batch', 'class',
    'parent', 'guardian', 'father', 'mother', 'referrer', 'referred',
    'bank', 'account', 'user', 'file', 'document',
];

const looksLikeEmail = (v: FieldValue) => kind(v).includes('email') || label(v).includes('email');

const looksLikePhone = (v: FieldValue) =>
    kind(v).includes('phone') || label(v).includes('phone') || label(v).includes('mobile');

const looksLikeName = (v: FieldValue) => {
    const l = label(v);
    if (!l.includes('name')) return false;
    if (looksLikeEmail(v) || looksLikePhone(v)) return false;
    return !NOT_THE_LEARNER.some((word) => l.includes(word));
};

const filled = (v: FieldValue) => (v.value ?? '').trim() !== '';

/** Key match with an answer → label match with an answer → key match → label match. */
const pick = (
    values: FieldValue[],
    keys: string[],
    matchesLabel: (v: FieldValue) => boolean
): string => {
    const byKey = values.filter((v) => hasKey(v, keys));
    const byLabel = values.filter((v) => !hasKey(v, keys) && matchesLabel(v));
    const chosen =
        byKey.find(filled) ?? byLabel.find(filled) ?? byKey[0] ?? byLabel[0];
    return chosen?.value?.trim() ?? '';
};

export interface LearnerIdentity {
    email: string;
    phone: string;
    name: string;
}

export const resolveLearnerIdentity = (values: FieldValue[]): LearnerIdentity => ({
    email: pick(values, EMAIL_KEYS, looksLikeEmail),
    phone: pick(values, PHONE_KEYS, looksLikePhone),
    name: pick(values, NAME_KEYS, looksLikeName),
});
