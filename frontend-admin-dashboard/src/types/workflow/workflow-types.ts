export interface Workflow {
    id: string;
    name: string;
    description: string;
    status: string;
    workflow_type: string;
    created_by_user_id: string;
    institute_id: string;
    created_at: string;
    updated_at: string;
    // Optional schedules for SCHEDULED workflows
    schedules?: WorkflowSchedule[];
    // Optional trigger for EVENT_DRIVEN/trigger workflows
    trigger?: WorkflowTrigger;
}

export interface WorkflowListResponse {
    workflows: Workflow[];
    totalCount: number;
}

export interface WorkflowSchedule {
    schedule_id: string | null;
    schedule_type: string | null; // e.g., CRON, INTERVAL
    cron_expression: string | null;
    interval_minutes: number | null;
    day_of_month: number | null;
    timezone: string | null;
    schedule_start_date: string | null;
    schedule_end_date: string | null;
    schedule_status: string | null;
    last_run_at: string | null;
    next_run_at: string | null;
    schedule_created_at: string | null;
    schedule_updated_at: string | null;
}

export interface WorkflowTrigger {
    trigger_id: string | null;
    trigger_event_name: string | null;
    trigger_description: string | null;
    trigger_status: string | null;
    trigger_created_at: string | null;
    trigger_updated_at: string | null;
}

export type NodeType =
    | 'TRIGGER'
    | 'ACTION'
    | 'DECISION'
    | 'EMAIL'
    | 'NOTIFICATION'
    | 'DATABASE'
    | 'WEBHOOK'
    | 'UNKNOWN';

export interface WorkflowNode {
    id: string;
    title: string;
    description?: string;
    type: NodeType;
    details?: Record<string, unknown>;
}

export interface WorkflowEdge {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    label: string;
}

export interface AutomationDiagram {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}
