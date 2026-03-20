import { useState, useEffect, useCallback } from 'react';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_SERVER_TIME } from '@/constants/urls';

export interface ServerTimeResponse {
    timestamp: number;
    iso_string: string;
    timezone: string;
    timezone_offset: string;
    utc_timestamp: number;
    utc_iso_string: string;
    formatted_time: string;
    day_of_week: string;
    day_of_year: number;
    week_of_year: number;
}

export interface ServerTimeData {
    serverTimestamp: number;
    userTimezone: string;
    timeDifference: number;
    fetchedAt: number;
}

// 1. Get server time
export const getServerTime = (data: ServerTimeData | null): number => {
    if (!data) return Date.now(); // Fallback to local time
    const elapsed = Date.now() - data.fetchedAt;
    return data.serverTimestamp + elapsed;
};

// 2. Get converted local time
export const getConvertedLocalTime = (data: ServerTimeData | null): Date => {
    return new Date(getServerTime(data));
};

// 3. Get time difference between user timezone and provided timezone
export const getTimeDifference = (data: ServerTimeData | null, targetTimezone: string): number => {
    const serverTime = getServerTime(data);
    const serverDate = new Date(serverTime);

    try {
        const utcTime = new Date(serverDate.toISOString());
        const targetTime = new Date(
            serverDate.toLocaleString('en-US', { timeZone: targetTimezone })
        );
        return (utcTime.getTime() - targetTime.getTime()) / (1000 * 60); // minutes
    } catch {
        return 0;
    }
};

// 4. Get converted time for a particular timestamp
export const getConvertedTime = (timestamp: number, data: ServerTimeData | null): Date => {
    if (!data) return new Date(timestamp);
    return new Date(timestamp + data.timeDifference);
};

// Get user timezone
export const getUserTimezone = (): string => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return 'UTC';
    }
};

// Main hook
export function useServerTime() {
    const [data, setData] = useState<ServerTimeData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchServerTime = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const start = Date.now();
            const response =
                await authenticatedAxiosInstance.get<ServerTimeResponse>(GET_SERVER_TIME);
            const end = Date.now();

            const latency = (end - start) / 2;
            const adjustedServerTime = response.data.timestamp + latency;
            const timeDifference = adjustedServerTime - Date.now();

            setData({
                serverTimestamp: adjustedServerTime,
                userTimezone: getUserTimezone(),
                timeDifference,
                fetchedAt: Date.now(),
            });
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch server time'));
            console.warn('Server time fetch failed, using local time');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchServerTime();
    }, [fetchServerTime]);

    return {
        data,
        loading,
        error,
        fetchServerTime,
        // Utility functions
        getServerTime: () => getServerTime(data),
        getConvertedLocalTime: () => getConvertedLocalTime(data),
        getTimeDifference: (tz: string) => getTimeDifference(data, tz),
        getConvertedTime: (timestamp: number) => getConvertedTime(timestamp, data),
        getUserTimezone,
    };
}
