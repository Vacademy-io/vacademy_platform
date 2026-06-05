import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

const AI_USAGE_BASE = `${BASE_URL}/admin-core-service/ai-usage/v1`;

// ── Types ──────────────────────────────────────────────────────────────────
export interface UserUsageRow {
    userId: string;
    name: string | null;
    email: string | null;
    roles: string | null; // comma-separated role names
    totalCredits: number;
    requestCount: number;
}

export interface RoleSummaryRow {
    role: string;
    userCount: number;
    totalCredits: number;
}

export interface UsageLogRow {
    id: string;
    createdAt: number | null; // epoch millis
    requestType: string | null;
    model: string | null;
    credits: number;
    description: string | null;
}

/** Shape MyTable expects. */
export interface TableData<T> {
    content: T[];
    total_pages: number;
    page_no: number;
    page_size: number;
    total_elements: number;
    last: boolean;
}

/** Raw Spring Data Page<T>. */
interface SpringPage<T> {
    content: T[];
    totalPages: number;
    totalElements: number;
    number: number;
    size: number;
    last: boolean;
}

const toTableData = <T>(page: SpringPage<T>): TableData<T> => ({
    content: page?.content ?? [],
    total_pages: page?.totalPages ?? 0,
    page_no: page?.number ?? 0,
    page_size: page?.size ?? 0,
    total_elements: page?.totalElements ?? 0,
    last: page?.last ?? true,
});

export interface UsageDateRange {
    startDate?: number; // epoch millis
    endDate?: number; // epoch millis
}

// ── Fetchers ─────────────────────────────────────────────────────────────────
export const fetchUsageUsers = async (
    page: number,
    pageSize: number,
    filters: UsageDateRange & { role?: string | null }
): Promise<TableData<UserUsageRow>> => {
    const response = await authenticatedAxiosInstance.get<SpringPage<UserUsageRow>>(
        `${AI_USAGE_BASE}/users`,
        {
            params: {
                page,
                size: pageSize,
                role: filters.role || undefined,
                startDate: filters.startDate,
                endDate: filters.endDate,
            },
        }
    );
    return toTableData(response.data);
};

export const fetchUsageSummary = async (filters: UsageDateRange): Promise<RoleSummaryRow[]> => {
    const response = await authenticatedAxiosInstance.get<RoleSummaryRow[]>(
        `${AI_USAGE_BASE}/summary`,
        { params: { startDate: filters.startDate, endDate: filters.endDate } }
    );
    return response.data ?? [];
};

export const fetchUsageUserLogs = async (
    userId: string,
    page: number,
    pageSize: number,
    filters: UsageDateRange
): Promise<TableData<UsageLogRow>> => {
    const response = await authenticatedAxiosInstance.get<SpringPage<UsageLogRow>>(
        `${AI_USAGE_BASE}/users/${userId}/logs`,
        {
            params: {
                page,
                size: pageSize,
                startDate: filters.startDate,
                endDate: filters.endDate,
            },
        }
    );
    return toTableData(response.data);
};

// ── Hooks ─────────────────────────────────────────────────────────────────────
export const useUsageUsersQuery = (
    page: number,
    pageSize: number,
    filters: UsageDateRange & { role?: string | null },
    enabled = true
) =>
    useQuery({
        queryKey: ['AI_USAGE_USERS', page, pageSize, filters],
        queryFn: () => fetchUsageUsers(page, pageSize, filters),
        enabled,
        placeholderData: keepPreviousData,
        staleTime: 60_000,
    });

export const useUsageSummaryQuery = (filters: UsageDateRange, enabled = true) =>
    useQuery({
        queryKey: ['AI_USAGE_SUMMARY', filters],
        queryFn: () => fetchUsageSummary(filters),
        enabled,
        staleTime: 60_000,
    });

export const useUsageUserLogsQuery = (
    userId: string | null,
    page: number,
    pageSize: number,
    filters: UsageDateRange,
    enabled = true
) =>
    useQuery({
        queryKey: ['AI_USAGE_USER_LOGS', userId, page, pageSize, filters],
        queryFn: () => fetchUsageUserLogs(userId as string, page, pageSize, filters),
        enabled: enabled && !!userId,
        placeholderData: keepPreviousData,
        staleTime: 60_000,
    });

// ── Date helper: DateRangeFilter gives DD/MM/YYYY → epoch millis ──────────────
export const ddmmyyyyToMillis = (s: string | undefined, endOfDay = false): number | undefined => {
    if (!s) return undefined;
    const [d, m, y] = s.split('/').map(Number);
    if (!d || !m || !y) return undefined;
    const date = endOfDay
        ? new Date(y, m - 1, d, 23, 59, 59, 999)
        : new Date(y, m - 1, d, 0, 0, 0, 0);
    return date.getTime();
};
