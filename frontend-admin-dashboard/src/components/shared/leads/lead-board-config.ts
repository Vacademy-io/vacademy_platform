import type { StageAccent } from './lead-stage-chip';
import type { LeadKpiMetric } from './use-lead-kpi-counts';

/**
 * LeadBoardColumnConfig — a data-driven board column. Columns are intentionally
 * config-driven (not hardcoded) so a future "lead statuses" settings screen can
 * supply custom columns without touching the board components.
 */
export interface LeadBoardColumnConfig {
    id: string;
    label: string;
    accent: StageAccent;
    /** Extra filter params merged into the per-column list request. */
    params: {
        lead_tier?: string;
        conversion_status_filter?: 'EXCLUDE_CONVERTED' | 'ONLY_CONVERTED' | 'ALL';
    };
    /** KPI metric whose count labels this column header (reuses the KPI fetch). */
    kpiMetric?: LeadKpiMetric;
}

/** Default pipeline: tier columns for active leads + a Converted bucket. */
export const DEFAULT_BOARD_COLUMNS: LeadBoardColumnConfig[] = [
    {
        id: 'hot',
        label: 'Hot',
        accent: 'red',
        params: { lead_tier: 'HOT', conversion_status_filter: 'EXCLUDE_CONVERTED' },
        kpiMetric: 'HOT',
    },
    {
        id: 'warm',
        label: 'Warm',
        accent: 'amber',
        params: { lead_tier: 'WARM', conversion_status_filter: 'EXCLUDE_CONVERTED' },
        kpiMetric: 'WARM',
    },
    {
        id: 'cold',
        label: 'Cold',
        accent: 'blue',
        params: { lead_tier: 'COLD', conversion_status_filter: 'EXCLUDE_CONVERTED' },
        kpiMetric: 'COLD',
    },
    {
        id: 'converted',
        label: 'Converted',
        accent: 'emerald',
        params: { conversion_status_filter: 'ONLY_CONVERTED' },
        kpiMetric: 'CONVERTED',
    },
];
