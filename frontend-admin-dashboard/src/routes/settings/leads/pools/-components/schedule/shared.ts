/**
 * Shared types and helpers for the two TIME_BASED schedule editors:
 *   - PerDayScheduleEditor          (schedule_pattern = PER_DAY)
 *   - SameHoursAllDaysEditor        (schedule_pattern = SAME_HOURS_ALL_DAYS)
 *
 * Both editors produce the same backend payload (flat ShiftBlockRequest[])
 * and read from the same flat PoolShiftDTO[]. The pattern only affects how
 * the admin authors / reads the data — storage is identical.
 */

import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSTITUTE_USERS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type { DayOfWeek, PoolShiftDTO } from '@/services/counselor-pool';

export const DAY_LABEL: Record<DayOfWeek, string> = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
    SUN: 'Sunday',
};

export const START_OF_DAY = '00:00:00';
export const END_OF_DAY = '23:59:59';

export interface EditableShift {
    /** Local-only client id for React keys. */
    localId: string;
    startTime: string; // "HH:mm:ss"
    endTime: string;
    label?: string;
    counselorUserIds: string[];
}

export interface InstituteUser {
    id: string;
    full_name: string;
}

export const fetchCounselors = async (): Promise<InstituteUser[]> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_INSTITUTE_USERS,
        params: { instituteId, pageNumber: 0, pageSize: 500 },
        data: { roles: ['COUNSELLOR', 'ADMIN'], status: ['ACTIVE'] },
    });
    const raw = Array.isArray(response.data) ? response.data : response.data?.content || [];
    return raw.map((u: Record<string, unknown>) => ({
        id: u.id as string,
        full_name: u.full_name as string,
    }));
};

/** "HH:mm:ss" → "HH:mm" for <input type="time"> default render. */
export function trimToHM(t: string): string {
    return t?.slice(0, 5) ?? '';
}

/** "HH:mm" → "HH:mm:00". */
export function padToFullTime(hm: string): string {
    return hm.length === 5 ? `${hm}:00` : hm;
}

/**
 * The HTML <input type="time"> with step=60 emits "HH:mm" which we pad to
 * "HH:mm:00". For end-of-day, that produces "23:59:00" — but the backend's
 * coverage rule and the routing engine want "23:59:59" exactly. Snap any
 * end-of-day-shaped value up to ":59" so the validator and save mapper
 * agree with the backend.
 */
export function normalizeEndOfDay(t: string): string {
    return t === '23:59:00' ? END_OF_DAY : t;
}

// ─── Compact-view helpers ──────────────────────────────────────────────────

/**
 * Reconstruct the canonical 24h template (for SAME_HOURS_ALL_DAYS) from the
 * flat shift rows the backend returned. Trusts that all 7 days are
 * structurally identical (the schedule_pattern column guarantees this), so it
 * reads Monday's rows. Any pair of (00:00–T) + (T'–23:59:59) with the same
 * counsellor set is merged into one overnight block.
 *
 * Used by SameHoursAllDaysEditor on load and by ScheduleReadView for the
 * compact view.
 */
export function reconstructSameHoursTemplate(server: PoolShiftDTO[]): EditableShift[] {
    const mondays = server
        .filter((s) => s.day_of_week === ('MON' as DayOfWeek))
        .sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (mondays.length === 0) return [];

    const blocks: EditableShift[] = mondays.map((s) => ({
        localId: s.id,
        startTime: s.start_time,
        endTime: s.end_time,
        label: s.label,
        counselorUserIds: (s.members ?? []).map((m) => m.counselor_user_id),
    }));

    const morningIdx = blocks.findIndex((b) => b.startTime === START_OF_DAY);
    const eveningIdx = blocks.findIndex((b) => b.endTime === END_OF_DAY);
    if (
        morningIdx >= 0 &&
        eveningIdx >= 0 &&
        morningIdx !== eveningIdx &&
        sameMemberSet(blocks[morningIdx]!.counselorUserIds, blocks[eveningIdx]!.counselorUserIds)
    ) {
        const morning = blocks[morningIdx]!;
        const evening = blocks[eveningIdx]!;
        const merged: EditableShift = {
            localId: cryptoRandom(),
            startTime: evening.startTime,
            endTime: morning.endTime,
            label: evening.label ?? morning.label,
            counselorUserIds: evening.counselorUserIds,
        };
        const remaining = blocks.filter((_, i) => i !== morningIdx && i !== eveningIdx);
        return [...remaining, merged].sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
        );
    }

    return blocks;
}

/** Group flat shift rows by day for the PER_DAY compact view. */
export function groupShiftsByDay(server: PoolShiftDTO[]): Record<DayOfWeek, PoolShiftDTO[]> {
    const out: Record<DayOfWeek, PoolShiftDTO[]> = {
        MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [],
    };
    for (const s of server) {
        out[s.day_of_week].push(s);
    }
    for (const day of Object.keys(out) as DayOfWeek[]) {
        out[day].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return out;
}

function sameMemberSet(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    return b.every((x) => setA.has(x));
}

export function cryptoRandom(): string {
    return Math.random().toString(36).slice(2, 10);
}

export function extractError(err: unknown): string | undefined {
    return (
        (err as { response?: { data?: { ex?: string; message?: string } } })?.response?.data?.ex ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    );
}

// ─── Validation ────────────────────────────────────────────────────────────

export interface ShiftError {
    localId: string;
    message: string;
}

/**
 * Validate one day's worth of shifts (or the canonical 24h template used by
 * the same-hours-all-days editor). Checks:
 *   - every block has ≥1 counsellor
 *   - every block has start < end (no overnight; if overnight is allowed by the
 *     caller, split it at midnight before calling this)
 *   - blocks tile [00:00:00, 23:59:59] with no gaps
 *
 * Returns top-level coverage errors plus per-shift errors keyed by localId.
 */
export function validateDayCoverage(
    shifts: EditableShift[],
    opts?: { allowGaps?: boolean }
): {
    ok: boolean;
    coverageErrors: string[];
    shiftErrors: ShiftError[];
} {
    // allowGaps = shift-aware ROUND_ROBIN: the schedule defines WHEN leads are
    // assigned; outside the blocks nobody is picked (lead left unassigned). So
    // gaps, a non-midnight start, and not reaching end-of-day are all fine —
    // we only validate the blocks themselves. TIME_BASED still requires full
    // 24/7 coverage (allowGaps falsy).
    const allowGaps = opts?.allowGaps ?? false;
    const coverageErrors: string[] = [];
    const shiftErrors: ShiftError[] = [];

    if (shifts.length === 0) {
        // With gaps allowed, "no shifts" just means no assignment window — the
        // caller decides whether an empty schedule is acceptable overall.
        return allowGaps
            ? { ok: true, coverageErrors, shiftErrors }
            : { ok: false, coverageErrors: ['No shifts configured.'], shiftErrors };
    }

    for (const s of shifts) {
        if (s.counselorUserIds.length === 0) {
            shiftErrors.push({ localId: s.localId, message: 'Add at least one counsellor.' });
        }
        if (s.startTime >= s.endTime) {
            shiftErrors.push({
                localId: s.localId,
                message: 'End time must be after start time.',
            });
        }
    }

    if (allowGaps) {
        // No coverage walk — only the per-block checks above matter.
        return { ok: shiftErrors.length === 0, coverageErrors, shiftErrors };
    }

    // Snap minute-precision end-of-day (23:59:00) to second-precision
    // before walking coverage, so admins entering "11:59 PM" don't trip a
    // 1-second-gap error that gets re-mapped to 23:59:59 at save anyway.
    const sorted = [...shifts]
        .map((s) => ({ ...s, endTime: normalizeEndOfDay(s.endTime) }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const first = sorted[0]!;
    if (first.startTime !== START_OF_DAY) {
        coverageErrors.push(
            `Schedule must start at 00:00 (first block: ${first.startTime}).`
        );
    }
    let coveredUntil = first.endTime;
    for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i]!;
        if (next.startTime > coveredUntil) {
            coverageErrors.push(`Gap between ${coveredUntil} and ${next.startTime}.`);
        }
        if (next.endTime > coveredUntil) coveredUntil = next.endTime;
    }
    if (coveredUntil < END_OF_DAY) {
        coverageErrors.push(`Schedule must cover up to end of day (covered until ${coveredUntil}).`);
    }

    return {
        ok: coverageErrors.length === 0 && shiftErrors.length === 0,
        coverageErrors,
        shiftErrors,
    };
}
