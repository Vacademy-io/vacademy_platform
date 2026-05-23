import { cn } from '@/lib/utils';
import type { LeadCardVM } from './lead-view-model';
import type { LeadActionHandlers } from './lead-actions';
import type { LeadBoardColumnConfig } from './lead-board-config';
import { DEFAULT_BOARD_COLUMNS } from './lead-board-config';
import { LeadBoardColumn } from './lead-board-column';
import type { LeadKpiMetric } from './use-lead-kpi-counts';

/**
 * LeadBoard — the "Deals Pipeline" Kanban view. Renders one LeadBoardColumn per
 * config entry; each column fetches and pages independently. Column header
 * counts reuse the KPI counts so no extra requests are made for the headers.
 */

interface BoardPage {
    content: unknown[];
    last: boolean;
}

interface LeadBoardProps {
    columns?: LeadBoardColumnConfig[];
    fetchFn: (payload: Record<string, unknown>) => Promise<BoardPage>;
    basePayload: Record<string, unknown>;
    surfaceId: string;
    scopeId: string;
    counts: Record<LeadKpiMetric, number | undefined>;
    showScore: boolean;
    showOps: boolean;
    toVM: (raw: unknown) => LeadCardVM;
    actions: LeadActionHandlers;
    className?: string;
}

export function LeadBoard({
    columns = DEFAULT_BOARD_COLUMNS,
    fetchFn,
    basePayload,
    surfaceId,
    scopeId,
    counts,
    showScore,
    showOps,
    toVM,
    actions,
    className,
}: LeadBoardProps) {
    return (
        <div className={cn('flex gap-3 overflow-x-auto pb-2', className)}>
            {columns.map((config) => (
                <LeadBoardColumn
                    key={config.id}
                    config={config}
                    fetchFn={fetchFn}
                    basePayload={basePayload}
                    surfaceId={surfaceId}
                    scopeId={scopeId}
                    count={config.kpiMetric ? counts[config.kpiMetric] : undefined}
                    showScore={showScore}
                    showOps={showOps}
                    toVM={toVM}
                    actions={actions}
                />
            ))}
        </div>
    );
}
