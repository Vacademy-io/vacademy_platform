/**
 * Data layer for the Reports Center's self-serve Custom Report Builder:
 *
 *   GET  /admin-core-service/v1/reports/custom/catalog   (available fields)
 *   POST /admin-core-service/v1/reports/custom/run       (execute a spec)
 *
 * The builder never sends SQL — only dimension/measure/filter KEYS from the catalog. The server
 * validates every key and binds filter values as parameters. RBAC-scoped like every other report.
 */
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

const CATALOG_URL = `${BASE_URL}/admin-core-service/v1/reports/custom/catalog`;
const RUN_URL = `${BASE_URL}/admin-core-service/v1/reports/custom/run`;

// ── Catalog ────────────────────────────────────────────────────────────

export interface CatalogField {
    key: string;
    label: string;
    type: string; // 'string' | 'number'
}

export interface CatalogFilterOption {
    value: string;
    label: string;
}

export interface CatalogFilterField {
    key: string;
    label: string;
    options: CatalogFilterOption[];
}

export interface CustomReportCatalog {
    dimensions: CatalogField[];
    measures: CatalogField[];
    filters: CatalogFilterField[];
}

export const customCatalogQueryKey = (instituteId: string) =>
    ['crm-reports-custom-catalog', instituteId] as const;

export async function fetchCustomCatalog(instituteId: string): Promise<CustomReportCatalog> {
    const { data } = await authenticatedAxiosInstance.get(CATALOG_URL, { params: { instituteId } });
    return {
        dimensions: Array.isArray(data?.dimensions) ? data.dimensions : [],
        measures: Array.isArray(data?.measures) ? data.measures : [],
        filters: Array.isArray(data?.filters) ? data.filters : [],
    };
}

// ── Run ────────────────────────────────────────────────────────────────

export interface CustomReportFilter {
    field: string;
    values: string[];
}

export interface CustomReportSort {
    field: string;
    dir: 'asc' | 'desc';
}

export interface CustomReportRunRequest {
    instituteId: string;
    fromDate?: string;
    toDate?: string;
    teamId?: string;
    counsellorUserId?: string;
    dimensions: string[];
    measures: string[];
    filters?: CustomReportFilter[];
    sort?: CustomReportSort;
    limit?: number;
}

export interface CustomReportColumn {
    key: string;
    label: string;
    kind: 'dimension' | 'measure';
    type: 'string' | 'number';
}

export interface CustomReportResult {
    columns: CustomReportColumn[];
    rows: Array<Array<string | number | null>>;
    row_count: number;
    truncated: boolean;
}

export async function runCustomReport(req: CustomReportRunRequest): Promise<CustomReportResult> {
    // The backend DTO (CustomReportRequest) is @JsonNaming(SnakeCaseStrategy), so the
    // body MUST be snake_case — posting camelCase leaves institute_id null and the
    // server rejects with "instituteId is required". (filters' field/values and sort's
    // field/dir are single words, already snake-compatible.)
    const body = {
        institute_id: req.instituteId,
        from_date: req.fromDate,
        to_date: req.toDate,
        team_id: req.teamId,
        counsellor_user_id: req.counsellorUserId,
        dimensions: req.dimensions,
        measures: req.measures,
        filters: req.filters,
        sort: req.sort,
        limit: req.limit,
    };
    const { data } = await authenticatedAxiosInstance.post(RUN_URL, body);
    return {
        columns: Array.isArray(data?.columns) ? data.columns : [],
        rows: Array.isArray(data?.rows) ? data.rows : [],
        row_count: data?.row_count ?? 0,
        truncated: !!data?.truncated,
    };
}
