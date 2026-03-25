import type { IntervalType } from '../-types/types';

/**
 * Get relative time label for timeline display based on interval type and interval ID
 * @param intervalType - Type of interval (daily, weekly, monthly, yearly_month, yearly_quarter)
 * @param intervalTypeId - The interval ID to compare against current time
 * @returns Relative time label (e.g., "today", "tomorrow", "past days", "later")
 */
export function getRelativeTimeLabel(intervalType: IntervalType, intervalTypeId: string): string {
    const now = new Date();

    switch (intervalType) {
        case 'daily':
            return getDailyLabel(intervalTypeId, now);
        case 'weekly':
            return getWeeklyLabel(intervalTypeId, now);
        case 'monthly':
            return getMonthlyLabel(intervalTypeId, now);
        case 'yearly_month':
            return getYearlyMonthLabel(intervalTypeId, now);
        case 'yearly_quarter':
            return getYearlyQuarterLabel(intervalTypeId, now);
        default:
            return intervalTypeId;
    }
}

/**
 * Daily: YYYY-MM-DD
 * Returns: "past days", "today", "tomorrow", "later"
 */
function getDailyLabel(intervalTypeId: string, now: Date): string {
    const logDate = new Date(intervalTypeId);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());

    if (logDateOnly.getTime() === today.getTime()) {
        return 'Today';
    } else if (logDateOnly.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
    } else if (logDateOnly < today) {
        return 'Past days';
    } else {
        return 'Later';
    }
}

/**
 * Weekly: YYYY_D0X (where X is 1-7, representing Mon-Sun)
 * Returns: "past days", "today", "tomorrow", "later"
 */
function getWeeklyLabel(intervalTypeId: string, now: Date): string {
    // Extract day of week from interval ID (1-7)
    const dayNum = parseInt(intervalTypeId.slice(-1));

    // Get current day of week (1-7, where 1 = Monday, 7 = Sunday)
    const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay();

    if (dayNum === currentDayOfWeek) {
        return 'Today';
    } else if (dayNum === (currentDayOfWeek % 7) + 1) {
        return 'Tomorrow';
    } else if (dayNum < currentDayOfWeek) {
        return 'Past days';
    } else {
        return 'Later';
    }
}

/**
 * Monthly: YYYY_MM_W0X (where X is 1-5, representing week of month)
 * Returns: "past week", "today", "next week", "later"
 */
function getMonthlyLabel(intervalTypeId: string, now: Date): string {
    const parts = intervalTypeId.split('_');
    const year = parseInt(parts[0]!);
    const month = parseInt(parts[1]!);
    const weekOfMonth = parseInt(parts[2]!.slice(-1));

    // Get current week of month
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 0-indexed to 1-indexed

    // Calculate current week of month using calendar weeks (Monday-Sunday)
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const currentDate = now.getDate();

    // Get day of week for first day of month (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    let firstDayOfWeek = firstDayOfMonth.getDay();
    // Convert Sunday (0) to 7 for easier calculation (Monday = 1, Sunday = 7)
    if (firstDayOfWeek === 0) firstDayOfWeek = 7;

    // Calculate which week the current date falls into
    // Days before the first Monday are in week 1
    // Then each Monday starts a new week
    const daysFromFirstMonday = currentDate - (8 - firstDayOfWeek);
    let currentWeekOfMonth;

    if (daysFromFirstMonday <= 0) {
        // We're in the first week (before or including the first Sunday)
        currentWeekOfMonth = 1;
    } else {
        // We're past the first week, calculate which week
        currentWeekOfMonth = Math.ceil(daysFromFirstMonday / 7) + 1;
    }

    // If different year or month, compare chronologically
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
        return 'Past week';
    } else if (year > currentYear || (year === currentYear && month > currentMonth)) {
        return 'Later';
    }

    // Same year and month, compare week
    if (weekOfMonth === currentWeekOfMonth) {
        return 'Today';
    } else if (weekOfMonth === currentWeekOfMonth + 1) {
        return 'Next week';
    } else if (weekOfMonth < currentWeekOfMonth) {
        return 'Past week';
    } else {
        return 'Later';
    }
}

/**
 * Yearly Month: YYYY_MXX (where XX is 01-12, representing month)
 * Returns: "past month", "today", "next month", "later"
 */
function getYearlyMonthLabel(intervalTypeId: string, now: Date): string {
    const parts = intervalTypeId.split('_');
    const year = parseInt(parts[0]!);
    const month = parseInt(parts[1]!.slice(1)); // Remove 'M' prefix

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 0-indexed to 1-indexed

    if (year === currentYear && month === currentMonth) {
        return 'Today';
    } else if (
        (year === currentYear && month === currentMonth + 1) ||
        (year === currentYear + 1 && currentMonth === 12 && month === 1)
    ) {
        return 'Next month';
    } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
        return 'Past month';
    } else {
        return 'Later';
    }
}

/**
 * Yearly Quarter: YYYY_Q0X (where X is 1-4, representing quarter)
 * Returns: "past quarter", "today", "next quarter", "later"
 */
function getYearlyQuarterLabel(intervalTypeId: string, now: Date): string {
    const parts = intervalTypeId.split('_');
    const year = parseInt(parts[0]!);
    const quarter = parseInt(parts[1]!.slice(-1)); // Get last character

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 0-indexed to 1-indexed
    const currentQuarter = Math.ceil(currentMonth / 3);

    if (year === currentYear && quarter === currentQuarter) {
        return 'Today';
    } else if (
        (year === currentYear && quarter === currentQuarter + 1) ||
        (year === currentYear + 1 && currentQuarter === 4 && quarter === 1)
    ) {
        return 'Next quarter';
    } else if (year < currentYear || (year === currentYear && quarter < currentQuarter)) {
        return 'Past quarter';
    } else {
        return 'Later';
    }
}
