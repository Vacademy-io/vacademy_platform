import type { BookRequest } from "../-services/booking-services";

/**
 * Whether the booking form has anything left to ask.
 *
 * A signed-in learner has already told us their name, email and phone; the
 * authenticated book endpoint fills those in from their account. So the details step
 * only earns its place when the page carries its own questions. Skipping it turns
 * "book a 1:1" into one tap instead of a slot, a form and a submit.
 *
 * A public (unauthenticated) link always asks — there the form IS the identity.
 */
export function shouldSkipDetails(authed: boolean, formFieldCount: number): boolean {
    return authed && formFieldCount === 0;
}

/** The invitee identity a booking carries, as the form holds it. */
export interface InviteeIdentity {
    name?: string;
    email?: string;
    phone?: string;
}

/**
 * Build the book request.
 *
 * Empty identity fields are OMITTED rather than sent as "": on the authenticated
 * endpoint an absent field means "use my account", while an empty string would be a
 * deliberate blank and fail the "email or phone is required" check.
 */
export function buildBookPayload(args: {
    identity: InviteeIdentity;
    startTime: string;
    inviteeTimezone: string;
    customFieldValues?: Record<string, string>;
    durationMinutes?: number;
}): BookRequest {
    const { identity, startTime, inviteeTimezone, customFieldValues, durationMinutes } = args;
    const trimmed = (v?: string) => (v && v.trim() ? v.trim() : undefined);
    return {
        ...(trimmed(identity.name) ? { name: trimmed(identity.name) } : {}),
        ...(trimmed(identity.email) ? { email: trimmed(identity.email) } : {}),
        ...(trimmed(identity.phone) ? { phone: trimmed(identity.phone) } : {}),
        start_time: startTime,
        invitee_timezone: inviteeTimezone,
        ...(customFieldValues && Object.keys(customFieldValues).length
            ? { custom_field_values: customFieldValues }
            : {}),
        ...(durationMinutes ? { duration_minutes: durationMinutes } : {}),
    };
}
