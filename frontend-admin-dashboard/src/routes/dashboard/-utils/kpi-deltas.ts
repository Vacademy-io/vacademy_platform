// Tracks prior values for each KPI in localStorage so the dashboard can show
// "vs prior visit" trend deltas without any backend changes. The snapshot
// refreshes every ~24h, so the percentages reflect roughly day-over-day
// movement rather than session-over-session noise.

import type { DashboardKpi } from '../-services/dashboard-kpis-service';

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface KpiDelta {
    percent: number; // absolute, always >= 0
    direction: DeltaDirection;
    isPositive: boolean; // whether this movement is good for this metric
}

interface Snapshot {
    value: number;
    takenAt: number;
}

const KEY_PREFIX = 'vacademy:kpiSnap:';
const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h between snapshot refreshes
const MAX_TRUST_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // ignore snapshots older than 14d

// Per-KPI semantic: which direction of movement is "good" for the user.
// e.g. fewer overdue items = good = down arrow in green.
const GOOD_DIRECTION: Record<string, DeltaDirection> = {
    activeLearners: 'up',
    totalCourses: 'up',
    teamMembers: 'up',
    classesToday: 'up',
    outstandingFees: 'down',
    overdueItems: 'down',
};

const readSnapshots = (instituteId: string): Record<string, Snapshot> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(KEY_PREFIX + instituteId);
        return raw ? (JSON.parse(raw) as Record<string, Snapshot>) : {};
    } catch {
        return {};
    }
};

const writeSnapshots = (instituteId: string, snap: Record<string, Snapshot>): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(KEY_PREFIX + instituteId, JSON.stringify(snap));
    } catch {
        // Storage might be full or disabled. Failing silently is correct here.
    }
};

const computePercent = (current: number, prior: number): number => {
    if (prior === 0) return current === 0 ? 0 : 100;
    return ((current - prior) / Math.abs(prior)) * 100;
};

const dirOf = (pct: number): DeltaDirection => {
    if (pct > 0.5) return 'up';
    if (pct < -0.5) return 'down';
    return 'flat';
};

export const computeKpiDeltas = (
    items: DashboardKpi[],
    instituteId: string
): Record<string, KpiDelta> => {
    if (!instituteId || !items?.length) return {};
    const now = Date.now();
    const snap = readSnapshots(instituteId);
    const updated: Record<string, Snapshot> = { ...snap };
    const deltas: Record<string, KpiDelta> = {};

    for (const k of items) {
        const prior = snap[k.id];
        const ageMs = prior ? now - prior.takenAt : Infinity;

        // Compute delta only when we have a usable prior snapshot.
        if (prior && ageMs <= MAX_TRUST_WINDOW_MS && prior.value !== k.value) {
            const pct = computePercent(k.value, prior.value);
            const direction = dirOf(pct);
            const good = GOOD_DIRECTION[k.id] || 'up';
            deltas[k.id] = {
                percent: Math.abs(Math.round(pct * 10) / 10),
                direction,
                isPositive: direction === 'flat' ? true : direction === good,
            };
        }

        // Refresh the snapshot on first-seen or after the refresh window. This
        // keeps the comparison sliding day-to-day rather than freezing on the
        // first value we ever observed.
        if (!prior || ageMs > REFRESH_WINDOW_MS) {
            updated[k.id] = { value: k.value, takenAt: now };
        }
    }

    writeSnapshots(instituteId, updated);
    return deltas;
};
