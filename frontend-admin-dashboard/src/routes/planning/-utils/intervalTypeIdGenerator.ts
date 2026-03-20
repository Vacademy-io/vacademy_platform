import type { IntervalType } from '../-types/types';

/**
 * Generates interval_type_id for daily intervals
 * Format: YYYY-MM-DD (ISO date format)
 * @param date - The date to generate ID for
 * @returns Formatted interval_type_id (e.g., "2024-11-26")
 */
export function generateDailyId(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Generates interval_type_id for weekly intervals
 * Format: YYYY_D0X where X is 1-7 (Monday to Sunday) - Day of week
 * @param date - The date to generate ID for
 * @returns Formatted interval_type_id (e.g., "2024_D01" for Monday)
 */
export function generateWeeklyId(date: Date): string {
    const year = date.getFullYear();
    // getDay() returns 0-6 (Sunday-Saturday), we need 1-7 (Monday-Sunday)
    let dayOfWeek = date.getDay();
    // Convert Sunday (0) to 7, and shift others
    dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    return `${year}_D0${dayOfWeek}`;
}

/**
 * Generates interval_type_id for monthly intervals
 * Format: YYYY_MM_W0X where X is the week number of the month (1-5)
 * @param date - The date to generate ID for
 * @returns Formatted interval_type_id (e.g., "2024_01_W01" for first week of January)
 */
export function generateMonthlyId(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Calculate week of month
    const firstDayOfMonth = new Date(year, date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    const weekOfMonth = Math.ceil((dayOfMonth + firstDayOfMonth.getDay()) / 7);
    
    return `${year}_${month}_W0${weekOfMonth}`;
}

/**
 * Generates interval_type_id for yearly month intervals
 * Format: YYYY_MXX where XX is the month (01-12)
 * @param date - The date to generate ID for
 * @returns Formatted interval_type_id (e.g., "2024_M01" for January)
 */
export function generateYearlyMonthId(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}_M${month}`;
}

/**
 * Generates interval_type_id for yearly quarter intervals
 * Format: YYYY_Q0X where X is the quarter (1-4)
 * @param date - The date to generate ID for
 * @returns Formatted interval_type_id (e.g., "2024_Q01" for Q1)
 */
export function generateYearlyQuarterId(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    
    return `${year}_Q0${quarter}`;
}

/**
 * Generates interval_type_id based on interval type and date
 * @param intervalType - The type of interval
 * @param date - The date to generate ID for
 * @returns Formatted interval_type_id
 */
export function generateIntervalTypeId(intervalType: IntervalType, date: Date): string {
    switch (intervalType) {
        case 'daily':
            return generateDailyId(date);
        case 'weekly':
            return generateWeeklyId(date);
        case 'monthly':
            return generateMonthlyId(date);
        case 'yearly_month':
            return generateYearlyMonthId(date);
        case 'yearly_quarter':
            return generateYearlyQuarterId(date);
        default:
            throw new Error(`Unknown interval type: ${intervalType}`);
    }
}

/**
 * Validates interval_type_id format
 * @param id - The interval_type_id to validate
 * @returns true if valid, false otherwise
 */
export function validateIntervalTypeId(id: string): boolean {
    // Daily: YYYY-MM-DD
    const dailyPattern = /^\d{4}-\d{2}-\d{2}$/;
    // Weekly: YYYY_D0X (day of week 1-7)
    const weeklyPattern = /^\d{4}_D0[1-7]$/;
    // Monthly: YYYY_MM_W0X (week of month 1-5)
    const monthlyPattern = /^\d{4}_\d{2}_W0[1-5]$/;
    // Yearly Month: YYYY_MXX (month 01-12)
    const yearlyMonthPattern = /^\d{4}_M(0[1-9]|1[0-2])$/;
    // Yearly Quarter: YYYY_Q0X (quarter 1-4)
    const yearlyQuarterPattern = /^\d{4}_Q0[1-4]$/;
    
    return dailyPattern.test(id) || weeklyPattern.test(id) || 
           monthlyPattern.test(id) || yearlyMonthPattern.test(id) || 
           yearlyQuarterPattern.test(id);
}

/**
 * Parses interval_type_id to extract interval type
 * @param id - The interval_type_id to parse
 * @returns The interval type or null if invalid
 */
export function parseIntervalType(id: string): IntervalType | null {
    if (!validateIntervalTypeId(id)) return null;
    
    // Daily: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(id)) return 'daily';
    // Weekly: YYYY_D0X
    if (id.includes('_D0')) return 'weekly';
    // Monthly: YYYY_MM_W0X
    if (id.includes('_W0')) return 'monthly';
    // Yearly Month: YYYY_MXX
    if (id.includes('_M')) return 'yearly_month';
    // Yearly Quarter: YYYY_Q0X
    if (id.includes('_Q0')) return 'yearly_quarter';
    
    return null;
}
